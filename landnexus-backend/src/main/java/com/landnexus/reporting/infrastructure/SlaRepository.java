package com.landnexus.reporting.infrastructure;

import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * SLA data. It reads other modules' data only through the rpt_sla_items view. Every value is a bind parameter; the only
 * text spliced into SQL is the constant scope fragment.
 */
@Repository
public class SlaRepository {

    public record RuleRow(UUID id, String itemType, String title, int warnAfterHours, int breachAfterHours,
                          String responsibleRole, String escalateRole, boolean active, String note, long rowVersion) {
    }

    public record ItemRow(String itemType, String title, UUID entityId, String reference, UUID districtId, Instant since,
                          long ageHours, String responsibleRole, String level) {
    }

    public record CountRow(String itemType, String level, long count) {
    }

    public record Escalated(UUID id, String itemType, UUID entityId, Instant since, String level, String reference,
                            UUID districtId, String responsibleRole, String escalateRole, int thresholdHours) {
    }

    public record EscalationRow(UUID id, String itemType, UUID entityId, String reference, String level, int thresholdHours,
                                Instant since, String responsibleRole, String escalateRole, String triggeredBy, Instant createdAt) {
    }

    public record EscalationRows(List<EscalationRow> rows, long total) {
    }

    private static final RowMapper<RuleRow> RULE = (rs, i) -> new RuleRow(rs.getObject("id", UUID.class), rs.getString("item_type"),
            rs.getString("title"), rs.getInt("warn_after_hours"), rs.getInt("breach_after_hours"), rs.getString("responsible_role"),
            rs.getString("escalate_role"), rs.getBoolean("active"), rs.getString("note"), rs.getLong("row_version"));

    private static final String RULE_COLUMNS = "id, item_type, title, warn_after_hours, breach_after_hours, responsible_role, "
            + "escalate_role, active, note, row_version";

    private static final String ITEMS = """
            SELECT i.item_type, r.title, i.entity_id, i.reference, i.state_id, i.district_id, i.since,
                   GREATEST(0, floor(extract(epoch FROM (now() - i.since)) / 3600))::bigint AS age_hours,
                   r.responsible_role,
                   CASE WHEN i.since <= now() - r.breach_after_hours * interval '1 hour' THEN 'BREACH'
                        WHEN i.since <= now() - r.warn_after_hours * interval '1 hour' THEN 'WARNING'
                        ELSE 'ON_TIME' END AS sla_level
            FROM rpt_sla_items i JOIN sla_rules r ON r.item_type = i.item_type AND r.active
            WHERE 1=1""";

    private static final String ESCALATE = """
            INSERT INTO sla_escalations (item_type, entity_id, since, sla_level, reference, state_id, district_id,
                                         responsible_role, escalate_role, threshold_hours, triggered_by)
            SELECT i.item_type, i.entity_id, i.since, lvl.sla_level, i.reference, i.state_id, i.district_id, r.responsible_role,
                   CASE WHEN lvl.sla_level = 'BREACH' THEN r.escalate_role END, lvl.hours, :by
            FROM rpt_sla_items i
            JOIN sla_rules r ON r.item_type = i.item_type AND r.active
            CROSS JOIN LATERAL (VALUES ('WARNING', r.warn_after_hours), ('BREACH', r.breach_after_hours)) AS lvl(sla_level, hours)
            WHERE i.since <= now() - lvl.hours * interval '1 hour'%s
            ON CONFLICT (item_type, entity_id, since, sla_level) DO NOTHING
            RETURNING id, item_type, entity_id, since, sla_level, reference, district_id, responsible_role, escalate_role, threshold_hours""";

    private final NamedParameterJdbcTemplate named;

    public SlaRepository(NamedParameterJdbcTemplate named) {
        this.named = named;
    }

    // ------------------------------------------------------------------ rules

    public List<RuleRow> rules() {
        return named.query("SELECT " + RULE_COLUMNS + " FROM sla_rules ORDER BY item_type", Map.of(), RULE);
    }

    public Optional<RuleRow> rule(String itemType) {
        return named.query("SELECT " + RULE_COLUMNS + " FROM sla_rules WHERE item_type = :type", Map.of("type", itemType), RULE)
                .stream().findFirst();
    }

    /** Returns 0 when the row was changed by someone else since expectedVersion was read. */
    public int updateRule(String itemType, int warn, int breach, String responsible, String escalate, boolean active, long expectedVersion) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("type", itemType).addValue("warn", warn)
                .addValue("breach", breach).addValue("resp", responsible).addValue("esc", escalate, Types.VARCHAR)
                .addValue("active", active).addValue("ver", expectedVersion);
        return named.update("UPDATE sla_rules SET warn_after_hours = :warn, breach_after_hours = :breach, responsible_role = :resp, "
                + "escalate_role = :esc, active = :active, row_version = row_version + 1, updated_at = now() "
                + "WHERE item_type = :type AND row_version = :ver", p);
    }

    // ------------------------------------------------------------------ status

    public List<CountRow> counts(DistrictScope scope) {
        return named.query("SELECT item_type, sla_level, COUNT(*) AS n FROM (" + ITEMS + scope.sql("i.district_id")
                        + ") x GROUP BY item_type, sla_level", scope.params(),
                (rs, i) -> new CountRow(rs.getString("item_type"), rs.getString("sla_level"), rs.getLong("n")));
    }

    /** The overdue items (warning or breach), breaches first, then the longest waiting. */
    public List<ItemRow> overdueItems(DistrictScope scope, int limit) {
        MapSqlParameterSource p = new MapSqlParameterSource(scope.params()).addValue("limit", limit);
        return named.query("SELECT * FROM (" + ITEMS + scope.sql("i.district_id") + ") x WHERE sla_level <> 'ON_TIME' "
                        + "ORDER BY CASE sla_level WHEN 'BREACH' THEN 0 ELSE 1 END, age_hours DESC, reference LIMIT :limit", p,
                (rs, i) -> new ItemRow(rs.getString("item_type"), rs.getString("title"), rs.getObject("entity_id", UUID.class),
                        rs.getString("reference"), rs.getObject("district_id", UUID.class), rs.getTimestamp("since").toInstant(),
                        rs.getLong("age_hours"), rs.getString("responsible_role"), rs.getString("sla_level")));
    }

    // ------------------------------------------------------------------ escalation

    /**
     * Records every (item, level) that has newly passed its limit and returns only those new rows. Running it twice in a
     * row returns nothing the second time. districtId limits the scan to one district (null = all districts).
     */
    public List<Escalated> escalate(String triggeredBy, UUID districtId) {
        String sql = ESCALATE.formatted(districtId == null ? "" : " AND i.district_id = :district");
        MapSqlParameterSource p = new MapSqlParameterSource("by", triggeredBy);
        if (districtId != null) {
            p.addValue("district", districtId);
        }
        return named.query(sql, p, (rs, i) -> new Escalated(rs.getObject("id", UUID.class), rs.getString("item_type"),
                rs.getObject("entity_id", UUID.class), rs.getTimestamp("since").toInstant(), rs.getString("sla_level"),
                rs.getString("reference"), rs.getObject("district_id", UUID.class), rs.getString("responsible_role"),
                rs.getString("escalate_role"), rs.getInt("threshold_hours")));
    }

    public EscalationRows escalations(DistrictScope scope, int limit, int offset) {
        MapSqlParameterSource p = new MapSqlParameterSource(scope.params()).addValue("limit", limit).addValue("offset", offset);
        Long total = named.queryForObject("SELECT COUNT(*) FROM sla_escalations e WHERE 1=1" + scope.sql("e.district_id"),
                scope.params(), Long.class);
        List<EscalationRow> rows = named.query("SELECT e.id, e.item_type, e.entity_id, e.reference, e.sla_level, e.threshold_hours, e.since, "
                        + "e.responsible_role, e.escalate_role, e.triggered_by, e.created_at FROM sla_escalations e WHERE 1=1"
                        + scope.sql("e.district_id") + " ORDER BY e.created_at DESC, e.id LIMIT :limit OFFSET :offset", p,
                (rs, i) -> new EscalationRow(rs.getObject("id", UUID.class), rs.getString("item_type"), rs.getObject("entity_id", UUID.class),
                        rs.getString("reference"), rs.getString("sla_level"), rs.getInt("threshold_hours"), rs.getTimestamp("since").toInstant(),
                        rs.getString("responsible_role"), rs.getString("escalate_role"), rs.getString("triggered_by"),
                        rs.getTimestamp("created_at").toInstant()));
        return new EscalationRows(rows, total == null ? 0 : total);
    }
}