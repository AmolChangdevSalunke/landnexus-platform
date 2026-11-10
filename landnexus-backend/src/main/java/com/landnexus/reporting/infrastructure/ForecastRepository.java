package com.landnexus.reporting.infrastructure;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads the rpt_stage_durations and rpt_sla_items views and the SLA rules. Read-only; every value is a bind parameter. */
@Repository
public class ForecastRepository {

    public record OpenItem(String itemType, String title, UUID entityId, String reference, UUID districtId, Instant since,
                           double ageHours, int warnHours, int breachHours, String responsibleRole) {
    }

    private final NamedParameterJdbcTemplate named;

    public ForecastRepository(NamedParameterJdbcTemplate named) {
        this.named = named;
    }

    /** The hours of the most recent completed items of a stage, ascending. */
    public double[] durations(String stage, int limit) {
        List<Double> rows = named.query("SELECT hours FROM rpt_stage_durations WHERE stage = :stage ORDER BY completed_at DESC LIMIT :limit",
                Map.of("stage", stage, "limit", limit), (rs, i) -> rs.getDouble(1));
        double[] values = rows.stream().mapToDouble(Double::doubleValue).toArray();
        Arrays.sort(values);
        return values;
    }

    /** Everything that is waiting now (on time or late) for a stage with an active SLA rule, oldest first. */
    public List<OpenItem> openItems(DistrictScope scope, int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource(scope.params()).addValue("limit", limit);
        return named.query("""
                SELECT i.item_type, r.title, i.entity_id, i.reference, i.district_id, i.since,
                       GREATEST(0, extract(epoch FROM (now() - i.since)) / 3600.0) AS age_hours,
                       r.warn_after_hours, r.breach_after_hours, r.responsible_role
                FROM rpt_sla_items i JOIN sla_rules r ON r.item_type = i.item_type AND r.active
                WHERE i.item_type <> 'OBJECTION_WINDOW_NOT_CLOSED'""" + scope.sql("i.district_id") + " ORDER BY i.since LIMIT :limit", params,
                (rs, i) -> new OpenItem(rs.getString("item_type"), rs.getString("title"), rs.getObject("entity_id", UUID.class),
                        rs.getString("reference"), rs.getObject("district_id", UUID.class), rs.getTimestamp("since").toInstant(),
                        rs.getDouble("age_hours"), rs.getInt("warn_after_hours"), rs.getInt("breach_after_hours"), rs.getString("responsible_role")));
    }
}