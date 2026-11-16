package com.landnexus.reporting.infrastructure;

import com.landnexus.reporting.api.dto.MonitoringDtos.DistrictRow;
import com.landnexus.reporting.api.dto.MonitoringDtos.StatusAmount;
import com.landnexus.reporting.api.dto.MonitoringDtos.TrendPoint;
import com.landnexus.reporting.api.dto.MonitoringDtos.OfficerWorkload;
import com.landnexus.compensation.domain.PaymentChannel;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Optional;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Read-only aggregate queries for the dashboards (the services run in read-only transactions, so a write would fail).
 * They return counts and sums only, never personal data. Every value is a bind parameter; the only text spliced into
 * the SQL is the constant scope fragment.
 */
@Repository
public class DashboardRepository {

    public record LandTotals(long activeParcels, BigDecimal areaHa, long withBoundary) {
    }

    public Optional<UUID> districtIdOfProject(UUID projectId) {
        return named.query("SELECT district_id FROM projects WHERE id = :id", Map.of("id", projectId),
                (rs, row) -> rs.getObject(1, UUID.class)).stream().findFirst();
    }

    public boolean projectOwnedBy(UUID projectId, UUID userId) {
        return Boolean.TRUE.equals(named.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM projects p JOIN proposals pr ON pr.id = p.proposal_id
                               WHERE p.id = :project AND (p.owner_user_id = :user OR pr.owner_user_id = :user))
                """, Map.of("project", projectId, "user", userId), Boolean.class));
    }

    public Optional<UUID> districtIdOfTaluka(UUID talukaId) {
        return named.query("SELECT district_id FROM talukas WHERE id = :id", Map.of("id", talukaId),
                (rs, row) -> rs.getObject(1, UUID.class)).stream().findFirst();
    }

    public boolean projectHasTaluka(UUID projectId, UUID talukaId) {
        return Boolean.TRUE.equals(named.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM projects p
                    WHERE p.id = :project AND (
                        p.taluka_id = :taluka OR EXISTS (
                            SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id
                            WHERE pv.project_id = p.id AND v.taluka_id = :taluka
                        )
                    )
                )
                """, Map.of("project", projectId, "taluka", talukaId), Boolean.class));
    }

    public record AcqParcelTotals(long parcels, BigDecimal areaToAcquireHa) {
    }

    private final NamedParameterJdbcTemplate named;

    public DashboardRepository(NamedParameterJdbcTemplate named) {
        this.named = named;
    }

    public Set<UUID> districtIdsOfState(UUID stateId) {
        return new HashSet<>(named.query("SELECT id FROM districts WHERE state_id = :state", Map.of("state", stateId),
                (rs, i) -> rs.getObject(1, UUID.class)));
    }

    // ------------------------------------------------------------------ proposals and projects

    public Map<String, Long> proposalsByStatus(DashboardFilter f) {
        return filteredCounts("SELECT p.status, COUNT(*) FROM proposals p WHERE 1=1" + f.sql("p.district_id", "p.created_at",
                "EXISTS (SELECT 1 FROM projects pr WHERE pr.id = :projectId AND pr.proposal_id = p.id)",
                "(p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM proposal_villages pv JOIN villages v ON v.id = pv.village_id "
                        + "WHERE pv.proposal_id = p.id AND v.taluka_id = :talukaId) OR EXISTS (SELECT 1 FROM projects pr "
                        + "JOIN project_villages pv ON pv.project_id = pr.id JOIN villages v ON v.id = pv.village_id "
                        + "WHERE pr.proposal_id = p.id AND v.taluka_id = :talukaId))")
                + f.statusSql("p.status", "proposalStatus")
                + " GROUP BY p.status ORDER BY p.status", f.params());
    }

    public Map<String, Long> projectsByStatus(DashboardFilter f) {
        return filteredCounts("SELECT p.status, COUNT(*) FROM projects p WHERE 1=1" + f.sql("p.district_id", "p.created_at",
                "p.id = :projectId", "(p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id "
                        + "WHERE pv.project_id = p.id AND v.taluka_id = :talukaId))")
                + f.statusSql("p.status", "projectStatus")
                + " GROUP BY p.status ORDER BY p.status", f.params());
    }

    public BigDecimal projectsAreaHa(DashboardFilter f) {
        return named.queryForObject("SELECT COALESCE(SUM(p.estimated_land_area_ha), 0) FROM projects p WHERE 1=1"
                        + f.sql("p.district_id", "p.created_at", "p.id = :projectId",
                        "(p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id "
                                + "WHERE pv.project_id = p.id AND v.taluka_id = :talukaId))")
                        + f.statusSql("p.status", "projectStatus"),
                f.params(), BigDecimal.class);
    }

    // ------------------------------------------------------------------ land records

    public LandTotals landTotals(DashboardFilter f) {
        return named.queryForObject("""
                SELECT COUNT(*) FILTER (WHERE p.status = 'ACTIVE') AS active_parcels,
                       COALESCE(SUM(p.area_ha) FILTER (WHERE p.status = 'ACTIVE'), 0) AS area_ha,
                       COUNT(*) FILTER (WHERE p.status = 'ACTIVE' AND EXISTS (
                           SELECT 1 FROM parcel_boundaries b WHERE b.parcel_id = p.id AND b.superseded_at IS NULL)) AS with_boundary
                FROM land_parcels p WHERE 1=1""" + f.sql("p.district_id", "p.created_at",
                "EXISTS (SELECT 1 FROM case_parcels cp JOIN acquisition_cases ac ON ac.id = cp.case_id "
                        + "WHERE cp.parcel_id = p.id AND ac.project_id = :projectId)",
                "p.taluka_id = :talukaId"), f.params(),
                (rs, i) -> new LandTotals(rs.getLong("active_parcels"), rs.getBigDecimal("area_ha"), rs.getLong("with_boundary")));
    }

    public long documentsPendingVerification(DashboardFilter f) {
        return named.queryForObject("""
                SELECT COUNT(*) FROM land_documents d JOIN land_parcels p ON p.id = d.parcel_id
                WHERE d.verification_status = 'PENDING'""" + f.sql("p.district_id", "d.updated_at",
                "EXISTS (SELECT 1 FROM case_parcels cp JOIN acquisition_cases ac ON ac.id = cp.case_id "
                        + "WHERE cp.parcel_id = p.id AND ac.project_id = :projectId)",
                "p.taluka_id = :talukaId"), f.params(), Long.class);
    }

    // ------------------------------------------------------------------ acquisition

    public Map<String, Long> casesByStatus(DashboardFilter f) {
        return filteredCounts("SELECT c.status, COUNT(*) FROM acquisition_cases c WHERE 1=1" + caseFilters(f, "c")
                + " GROUP BY c.status ORDER BY c.status", f.params());
    }

    public AcqParcelTotals acquisitionParcels(DashboardFilter f) {
        return named.queryForObject("""
                SELECT COUNT(*) AS parcels, COALESCE(SUM(cp.area_to_acquire_ha), 0) AS area
                FROM case_parcels cp JOIN acquisition_cases c ON c.id = cp.case_id
                WHERE cp.released_at IS NULL AND c.status <> 'CANCELLED'""" + caseFilters(f, "c"), f.params(),
                (rs, i) -> new AcqParcelTotals(rs.getLong("parcels"), rs.getBigDecimal("area")));
    }

    public Map<String, Long> surveysByStatus(DashboardFilter f) {
        return filteredCounts("SELECT fs.status, COUNT(*) FROM field_surveys fs JOIN acquisition_cases c ON c.id = fs.case_id WHERE 1=1"
                + caseFilters(f, "c", "fs.created_at") + " GROUP BY fs.status ORDER BY fs.status", f.params());
    }

    public Map<String, Long> objectionsByStatus(DashboardFilter f) {
        return filteredCounts("SELECT o.status, COUNT(*) FROM objections o JOIN acquisition_cases c ON c.id = o.case_id WHERE 1=1"
                + caseFilters(f, "c", "o.created_at") + " GROUP BY o.status ORDER BY o.status", f.params());
    }

    public long awardsDeclared(DashboardFilter f) {
        return named.queryForObject("SELECT COUNT(*) FROM acquisition_awards a JOIN acquisition_cases c ON c.id = a.case_id WHERE 1=1"
                + caseFilters(f, "c", "a.created_at"), f.params(), Long.class);
    }

    public long possessionsRecorded(DashboardFilter f) {
        return named.queryForObject("SELECT COUNT(*) FROM possession_records r JOIN acquisition_cases c ON c.id = r.case_id WHERE 1=1"
                + caseFilters(f, "c", "r.created_at"), f.params(), Long.class);
    }

    // ------------------------------------------------------------------ compensation (shown only with the right permissions)

    public List<StatusAmount> estimatesByStatus(DashboardFilter f) {
        return amounts("SELECT v.status, COUNT(*), COALESCE(SUM(v.total_amount), 0) FROM valuations v JOIN acquisition_cases c ON c.id = v.case_id "
                + "WHERE v.status <> 'SUPERSEDED'" + caseFilters(f, "c", "v.created_at") + " GROUP BY v.status ORDER BY v.status", f.params());
    }

    public List<StatusAmount> paymentsByStatus(DashboardFilter f) {
        return amounts("SELECT p.status, COUNT(*), COALESCE(SUM(p.amount), 0) FROM compensation_payments p JOIN acquisition_cases c ON c.id = p.case_id "
                + "WHERE 1=1" + caseFilters(f, "c", "p.created_at") + " GROUP BY p.status ORDER BY p.status", f.params());
    }

    public List<StatusAmount> paymentsByChannelAndStatus(DashboardFilter f, PaymentChannel channel) {
        Map<String, Object> params = new LinkedHashMap<>(f.params());
        params.put("paymentChannel", channel.name());
        return amounts("SELECT p.status, COUNT(*), COALESCE(SUM(p.amount), 0) "
                + "FROM compensation_payments p JOIN acquisition_cases c ON c.id = p.case_id "
                + "WHERE p.payment_channel = :paymentChannel" + caseFilters(f, "c", "p.created_at")
                + " GROUP BY p.status ORDER BY p.status", params);
    }

    public Map<String, List<StatusAmount>> paymentsByChannel(DashboardFilter f) {
        Map<String, List<StatusAmount>> result = new LinkedHashMap<>();
        for (PaymentChannel channel : PaymentChannel.values()) {
            result.put(channel.name(), paymentsByChannelAndStatus(f, channel));
        }
        return result;
    }

    public Map<String, Long> rrCasesByStatus(DashboardFilter f) {
        return filteredCounts("SELECT r.status, COUNT(*) FROM rr_cases r JOIN acquisition_cases c ON c.id = r.case_id WHERE 1=1"
                + caseFilters(f, "c", "r.created_at") + " GROUP BY r.status ORDER BY r.status", f.params());
    }

    public Map<String, Long> escalationsByLevel(DashboardFilter f) {
        return filteredCounts("SELECT e.sla_level, COUNT(*) FROM sla_escalations e WHERE 1=1"
                + f.sql("e.district_id", "e.created_at", escalationProjectMatch(), escalationTalukaMatch())
                + " GROUP BY e.sla_level ORDER BY e.sla_level", f.params());
    }

    private static String escalationProjectMatch() {
        return """
                (
                  (e.item_type = 'PROPOSAL_AWAITING_SCRUTINY' AND EXISTS (
                    SELECT 1 FROM projects pr JOIN proposals p ON p.id = pr.proposal_id
                    WHERE p.id = e.entity_id AND pr.id = :projectId))
                  OR (e.item_type = 'DOCUMENT_AWAITING_VERIFICATION' AND EXISTS (
                    SELECT 1 FROM land_documents d JOIN land_parcels lp ON lp.id = d.parcel_id
                    JOIN case_parcels cp ON cp.parcel_id = lp.id JOIN acquisition_cases c ON c.id = cp.case_id
                    WHERE d.id = e.entity_id AND c.project_id = :projectId))
                  OR (e.item_type = 'SURVEY_AWAITING_VERIFICATION' AND EXISTS (
                    SELECT 1 FROM field_surveys fs JOIN acquisition_cases c ON c.id = fs.case_id
                    WHERE fs.id = e.entity_id AND c.project_id = :projectId))
                  OR (e.item_type = 'OBJECTION_AWAITING_DECISION' AND EXISTS (
                    SELECT 1 FROM objections o JOIN acquisition_cases c ON c.id = o.case_id
                    WHERE o.id = e.entity_id AND c.project_id = :projectId))
                  OR (e.item_type = 'OBJECTION_WINDOW_NOT_CLOSED' AND EXISTS (
                    SELECT 1 FROM acquisition_cases c WHERE c.id = e.entity_id AND c.project_id = :projectId))
                  OR (e.item_type = 'ESTIMATE_AWAITING_APPROVAL' AND EXISTS (
                    SELECT 1 FROM valuations v JOIN acquisition_cases c ON c.id = v.case_id
                    WHERE v.id = e.entity_id AND c.project_id = :projectId))
                  OR (e.item_type IN ('PAYMENT_AWAITING_RELEASE', 'PAYMENT_AWAITING_RESPONSE') AND EXISTS (
                    SELECT 1 FROM compensation_payments cp JOIN acquisition_cases c ON c.id = cp.case_id
                    WHERE cp.id = e.entity_id AND c.project_id = :projectId))
                )
                """;
    }

    private static String escalationTalukaMatch() {
        return """
                (
                  (e.item_type = 'PROPOSAL_AWAITING_SCRUTINY' AND EXISTS (
                    SELECT 1 FROM proposals p LEFT JOIN projects pr ON pr.proposal_id = p.id
                    WHERE p.id = e.entity_id AND (
                      p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM proposal_villages pv
                        JOIN villages v ON v.id = pv.village_id WHERE pv.proposal_id = p.id AND v.taluka_id = :talukaId)
                      OR pr.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM project_villages pv
                        JOIN villages v ON v.id = pv.village_id WHERE pv.project_id = pr.id AND v.taluka_id = :talukaId))))
                  OR (e.item_type = 'DOCUMENT_AWAITING_VERIFICATION' AND EXISTS (
                    SELECT 1 FROM land_documents d JOIN land_parcels lp ON lp.id = d.parcel_id
                    WHERE d.id = e.entity_id AND lp.taluka_id = :talukaId))
                  OR (e.item_type = 'SURVEY_AWAITING_VERIFICATION' AND EXISTS (
                    SELECT 1 FROM field_surveys fs JOIN acquisition_cases c ON c.id = fs.case_id
                    WHERE fs.id = e.entity_id AND (EXISTS (SELECT 1 FROM case_villages cv
                      JOIN villages v ON v.id = cv.village_id WHERE cv.case_id = c.id AND v.taluka_id = :talukaId)
                      OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id
                      WHERE pv.project_id = c.project_id AND v.taluka_id = :talukaId))))
                  OR (e.item_type = 'OBJECTION_AWAITING_DECISION' AND EXISTS (
                    SELECT 1 FROM objections o JOIN acquisition_cases c ON c.id = o.case_id
                    WHERE o.id = e.entity_id AND (EXISTS (SELECT 1 FROM case_villages cv
                      JOIN villages v ON v.id = cv.village_id WHERE cv.case_id = c.id AND v.taluka_id = :talukaId)
                      OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id
                      WHERE pv.project_id = c.project_id AND v.taluka_id = :talukaId))))
                  OR (e.item_type = 'OBJECTION_WINDOW_NOT_CLOSED' AND EXISTS (
                    SELECT 1 FROM acquisition_cases c WHERE c.id = e.entity_id AND
                      (EXISTS (SELECT 1 FROM case_villages cv JOIN villages v ON v.id = cv.village_id
                        WHERE cv.case_id = c.id AND v.taluka_id = :talukaId)
                       OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id
                        WHERE pv.project_id = c.project_id AND v.taluka_id = :talukaId))))
                  OR (e.item_type = 'ESTIMATE_AWAITING_APPROVAL' AND EXISTS (
                    SELECT 1 FROM valuations v JOIN acquisition_cases c ON c.id = v.case_id WHERE v.id = e.entity_id AND
                      (EXISTS (SELECT 1 FROM case_villages cv JOIN villages v2 ON v2.id = cv.village_id
                        WHERE cv.case_id = c.id AND v2.taluka_id = :talukaId)
                       OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v2 ON v2.id = pv.village_id
                        WHERE pv.project_id = c.project_id AND v2.taluka_id = :talukaId))))
                  OR (e.item_type IN ('PAYMENT_AWAITING_RELEASE', 'PAYMENT_AWAITING_RESPONSE') AND EXISTS (
                    SELECT 1 FROM compensation_payments cp JOIN acquisition_cases c ON c.id = cp.case_id WHERE cp.id = e.entity_id AND
                      (EXISTS (SELECT 1 FROM case_villages cv JOIN villages v ON v.id = cv.village_id
                        WHERE cv.case_id = c.id AND v.taluka_id = :talukaId)
                       OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id
                        WHERE pv.project_id = c.project_id AND v.taluka_id = :talukaId))))
                )
                """;
    }

    public long pendingTasks(DashboardFilter f) {
        return named.queryForObject("SELECT COUNT(*) FROM proposal_assignments a JOIN proposals p ON p.id = a.proposal_id "
                + "WHERE a.status IN ('PENDING', 'IN_PROGRESS')" + f.sql("p.district_id", "a.assigned_at",
                "EXISTS (SELECT 1 FROM projects pr WHERE pr.id = :projectId AND pr.proposal_id = p.id)",
                "(p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM proposal_villages pv JOIN villages v ON v.id = pv.village_id "
                        + "WHERE pv.proposal_id = p.id AND v.taluka_id = :talukaId) OR EXISTS (SELECT 1 FROM projects pr "
                        + "JOIN project_villages pv ON pv.project_id = pr.id JOIN villages v ON v.id = pv.village_id "
                        + "WHERE pr.proposal_id = p.id AND v.taluka_id = :talukaId))")
                + f.statusSql("p.status", "proposalStatus"), f.params(), Long.class);
    }

    public List<OfficerWorkload> officerWorkload(DashboardFilter f) {
        return named.query("""
                SELECT u.id, u.username,
                       COUNT(*) FILTER (WHERE a.status = 'PENDING') AS pending,
                       COUNT(*) FILTER (WHERE a.status = 'IN_PROGRESS') AS in_progress,
                       COUNT(*) FILTER (WHERE a.due_at IS NOT NULL AND a.due_at < now()
                                           AND a.status IN ('PENDING', 'IN_PROGRESS')) AS overdue
                FROM proposal_assignments a
                JOIN proposals p ON p.id = a.proposal_id
                JOIN users u ON u.id = a.assigned_user_id
                WHERE a.status IN ('PENDING', 'IN_PROGRESS')""" + f.sql("p.district_id", "a.assigned_at",
                        "EXISTS (SELECT 1 FROM projects pr WHERE pr.id = :projectId AND pr.proposal_id = p.id)",
                        "(p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM proposal_villages pv JOIN villages v ON v.id = pv.village_id "
                                + "WHERE pv.proposal_id = p.id AND v.taluka_id = :talukaId))")
                        + f.statusSql("p.status", "proposalStatus")
                        + " GROUP BY u.id, u.username ORDER BY COUNT(*) DESC, u.username LIMIT 100",
                f.params(), (rs, i) -> new OfficerWorkload(rs.getObject("id", UUID.class), rs.getString("username"),
                        rs.getLong("pending"), rs.getLong("in_progress"), rs.getLong("overdue")));
    }

    public long gisConflicts(DashboardFilter f) {
        return named.queryForObject("""
                SELECT COUNT(DISTINCT b.parcel_id) FROM parcel_boundaries b
                JOIN land_parcels p ON p.id = b.parcel_id
                JOIN case_parcels cp ON cp.parcel_id = p.id AND cp.released_at IS NULL
                JOIN acquisition_cases c ON c.id = cp.case_id
                JOIN project_alignments a ON a.project_id = c.project_id AND a.superseded_at IS NULL
                WHERE b.superseded_at IS NULL
                AND ST_Intersects(b.geom, ST_Buffer(a.geom::geography, (a.corridor_width_m / 2.0)::float8)::geometry)
                AND ST_Area(ST_CollectionExtract(ST_Intersection(b.geom,
                    ST_Buffer(a.geom::geography, (a.corridor_width_m / 2.0)::float8)::geometry), 3)::geography) > 0
                """ + f.sql("c.district_id", "c.created_at", "c.project_id = :projectId",
                        "EXISTS (SELECT 1 FROM case_villages cv JOIN villages v ON v.id = cv.village_id "
                                + "WHERE cv.case_id = c.id AND v.taluka_id = :talukaId)"), f.params(), Long.class);
    }

    private static String caseFilters(DashboardFilter f, String alias) {
        return caseFilters(f, alias, alias + ".created_at");
    }

    private static String caseFilters(DashboardFilter f, String alias, String dateColumn) {
        return f.sql(alias + ".district_id", dateColumn, alias + ".project_id = :projectId",
                "(EXISTS (SELECT 1 FROM case_villages cv JOIN villages v ON v.id = cv.village_id "
                        + "WHERE cv.case_id = " + alias + ".id AND v.taluka_id = :talukaId) "
                        + "OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id "
                        + "WHERE pv.project_id = " + alias + ".project_id AND v.taluka_id = :talukaId))")
                + f.statusSql(alias + ".status", "acquisitionStatus");
    }

    private Map<String, Long> filteredCounts(String sql, Map<String, Object> params) {
        Map<String, Long> result = new LinkedHashMap<>();
        named.query(sql, params, (RowCallbackHandler) rs -> result.put(rs.getString(1), rs.getLong(2)));
        return result;
    }

    // ------------------------------------------------------------------ trend and districts

    /** The last six months (Asia/Kolkata), oldest first. */
    public List<TrendPoint> trend(DashboardFilter f) {
        String sql = """
                SELECT to_char(m, 'YYYY-MM') AS month,
                       (SELECT COUNT(*) FROM proposals p WHERE p.submitted_at IS NOT NULL
                           AND date_trunc('month', p.submitted_at AT TIME ZONE 'Asia/Kolkata') = m %s) AS proposals_submitted,
                       (SELECT COUNT(*) FROM acquisition_cases c
                           WHERE date_trunc('month', c.created_at AT TIME ZONE 'Asia/Kolkata') = m %s) AS cases_opened
                FROM generate_series(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '5 months',
                                     date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata'), interval '1 month') AS m
                ORDER BY m
                """.formatted(f.sql("p.district_id", "p.submitted_at",
                        "EXISTS (SELECT 1 FROM projects pr WHERE pr.id = :projectId AND pr.proposal_id = p.id)",
                        "(p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM proposal_villages pv JOIN villages v ON v.id = pv.village_id "
                                + "WHERE pv.proposal_id = p.id AND v.taluka_id = :talukaId) OR EXISTS (SELECT 1 FROM projects pr "
                                + "JOIN project_villages pv ON pv.project_id = pr.id JOIN villages v ON v.id = pv.village_id "
                                + "WHERE pr.proposal_id = p.id AND v.taluka_id = :talukaId))")
                        + f.statusSql("p.status", "proposalStatus"),
                caseFilters(f, "c"));
        return named.query(sql, f.params(), (rs, i) -> new TrendPoint(rs.getString("month"), rs.getLong("proposals_submitted"),
                rs.getLong("cases_opened")));
    }

    /** Districts with any activity inside the scope (at most 500). */
    public List<DistrictRow> districtRows(DashboardFilter f) {
        DistrictScope s = f.districts();
        String projectWhere = f.sql("p.district_id", "p.created_at", "p.id = :projectId",
                "(p.taluka_id = :talukaId OR EXISTS (SELECT 1 FROM project_villages pv JOIN villages v ON v.id = pv.village_id "
                        + "WHERE pv.project_id = p.id AND v.taluka_id = :talukaId))")
                + f.statusSql("p.status", "projectStatus") + " AND p.district_id = d.id";
        String caseWhere = caseFilters(f, "c") + " AND c.district_id = d.id";
        String parcelWhere = f.sql("lp.district_id", "lp.created_at",
                "EXISTS (SELECT 1 FROM case_parcels cp JOIN acquisition_cases c ON c.id = cp.case_id "
                        + "WHERE cp.parcel_id = lp.id AND c.project_id = :projectId)",
                "lp.taluka_id = :talukaId") + " AND lp.district_id = d.id";
        String sql = """
                SELECT * FROM (
                    SELECT d.id, d.name AS district, st.name AS state,
                           (SELECT COUNT(*) FROM projects p WHERE 1=1 %s) AS projects,
                           (SELECT COUNT(*) FROM acquisition_cases c WHERE c.status NOT IN ('CANCELLED', 'CLOSED') %s) AS open_cases,
                           (SELECT COUNT(*) FROM land_parcels lp WHERE lp.status = 'ACTIVE' %s) AS parcels,
                           (SELECT COALESCE(SUM(cp.area_to_acquire_ha), 0) FROM case_parcels cp
                               JOIN acquisition_cases c ON c.id = cp.case_id
                               WHERE cp.released_at IS NULL AND c.status <> 'CANCELLED' %s) AS area_to_acquire
                    FROM districts d JOIN states st ON st.id = d.state_id
                    WHERE 1=1 %s
                ) t WHERE projects > 0 OR open_cases > 0 OR parcels > 0
                ORDER BY state, district LIMIT 500
                """.formatted(projectWhere, caseWhere, parcelWhere,
                caseFilters(f, "c", "c.created_at") + " AND c.district_id = d.id", s.sql("d.id"));
        return named.query(sql, f.params(), (rs, i) -> new DistrictRow(rs.getObject("id", UUID.class), rs.getString("district"),
                rs.getString("state"), rs.getLong("projects"), rs.getLong("open_cases"), rs.getLong("parcels"),
                rs.getBigDecimal("area_to_acquire")));
    }

    // ------------------------------------------------------------------ helpers

    private Map<String, Long> counts(String sql, DistrictScope s) {
        Map<String, Long> result = new LinkedHashMap<>();
        named.query(sql, s.params(), (RowCallbackHandler) rs -> result.put(rs.getString(1), rs.getLong(2)));
        return result;
    }

    private List<StatusAmount> amounts(String sql, Map<String, Object> params) {
        return named.query(sql, params, (rs, i) -> new StatusAmount(rs.getString(1), rs.getLong(2), rs.getBigDecimal(3)));
    }
}