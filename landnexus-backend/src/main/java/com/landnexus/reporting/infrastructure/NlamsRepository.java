package com.landnexus.reporting.infrastructure;

import com.landnexus.reporting.api.dto.NlamsDtos.NlamsProject;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Reads the NLAMS progress view. The only text spliced into the SQL is the constant scope fragment;
 * every value, including the optional state filter, is a bind parameter.
 */
@Repository
public class NlamsRepository {

    private static final String COLUMNS = """
            project_id, project_code, title, project_type, project_status, district_id, district_name,
            estimated_land_area_ha, alignment_length_km,
            cases, open_cases, cases_awaiting_notification, cases_notified, cases_awaiting_award, cases_possession_complete,
            parcels_identified, identified_ha, parcels_notified, notified_ha,
            awards, parcels_awarded, awarded_ha,
            parcels_possessed, possession_ha, possession_physical, possession_deemed,
            notices, objections, objections_open,
            assessed_total, awaiting_approval_total, paid_total, sent_total, failed_total, instructed_total,
            affected_families, displaced_families, livelihood_lost_families,
            rr_cases, rr_completed, rr_entitlements, rr_delivered
            """;

    private static final RowMapper<NlamsProject> MAPPER = (rs, i) -> new NlamsProject(
            rs.getObject("project_id", UUID.class),
            rs.getString("project_code"),
            rs.getString("title"),
            rs.getString("project_type"),
            rs.getString("project_status"),
            rs.getObject("district_id", UUID.class),
            rs.getString("district_name"),
            amount(rs.getBigDecimal("estimated_land_area_ha")),
            amount(rs.getBigDecimal("alignment_length_km")),
            rs.getLong("cases"),
            rs.getLong("open_cases"),
            rs.getLong("cases_awaiting_notification"),
            rs.getLong("cases_notified"),
            rs.getLong("cases_awaiting_award"),
            rs.getLong("cases_possession_complete"),
            rs.getLong("parcels_identified"),
            amount(rs.getBigDecimal("identified_ha")),
            rs.getLong("parcels_notified"),
            amount(rs.getBigDecimal("notified_ha")),
            rs.getLong("awards"),
            rs.getLong("parcels_awarded"),
            amount(rs.getBigDecimal("awarded_ha")),
            rs.getLong("parcels_possessed"),
            amount(rs.getBigDecimal("possession_ha")),
            rs.getLong("possession_physical"),
            rs.getLong("possession_deemed"),
            rs.getLong("notices"),
            rs.getLong("objections"),
            rs.getLong("objections_open"),
            amount(rs.getBigDecimal("assessed_total")),
            amount(rs.getBigDecimal("awaiting_approval_total")),
            amount(rs.getBigDecimal("paid_total")),
            amount(rs.getBigDecimal("sent_total")),
            amount(rs.getBigDecimal("failed_total")),
            amount(rs.getBigDecimal("instructed_total")),
            rs.getLong("affected_families"),
            rs.getLong("displaced_families"),
            rs.getLong("livelihood_lost_families"),
            rs.getLong("rr_cases"),
            rs.getLong("rr_completed"),
            rs.getLong("rr_entitlements"),
            rs.getLong("rr_delivered"),
            0,
            null);

    private final NamedParameterJdbcTemplate named;

    public NlamsRepository(NamedParameterJdbcTemplate named) {
        this.named = named;
    }

    public List<NlamsProject> findProjects(DistrictScope scope, UUID stateId) {
        Map<String, Object> params = new HashMap<>(scope.params());
        StringBuilder sql = new StringBuilder("SELECT ").append(COLUMNS).append(" FROM rpt_project_progress WHERE 1=1")
                .append(scope.sql("district_id"));
        if (stateId != null) {
            sql.append(" AND state_id = :stateId");
            params.put("stateId", stateId);
        }
        sql.append(" ORDER BY project_code");
        return named.query(sql.toString(), params, MAPPER);
    }

    private static BigDecimal amount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
