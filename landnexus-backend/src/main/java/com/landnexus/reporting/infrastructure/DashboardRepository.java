package com.landnexus.reporting.infrastructure;

import com.landnexus.reporting.api.dto.MonitoringDtos.DistrictRow;
import com.landnexus.reporting.api.dto.MonitoringDtos.StatusAmount;
import com.landnexus.reporting.api.dto.MonitoringDtos.TrendPoint;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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

    public Map<String, Long> proposalsByStatus(DistrictScope s) {
        return counts("SELECT p.status, COUNT(*) FROM proposals p WHERE 1=1" + s.sql("p.district_id") + " GROUP BY p.status ORDER BY p.status", s);
    }

    public Map<String, Long> projectsByStatus(DistrictScope s) {
        return counts("SELECT p.status, COUNT(*) FROM projects p WHERE 1=1" + s.sql("p.district_id") + " GROUP BY p.status ORDER BY p.status", s);
    }

    public BigDecimal projectsAreaHa(DistrictScope s) {
        return named.queryForObject("SELECT COALESCE(SUM(p.estimated_land_area_ha), 0) FROM projects p WHERE 1=1" + s.sql("p.district_id"),
                s.params(), BigDecimal.class);
    }

    // ------------------------------------------------------------------ land records

    public LandTotals landTotals(DistrictScope s) {
        return named.queryForObject("""
                SELECT COUNT(*) FILTER (WHERE p.status = 'ACTIVE') AS active_parcels,
                       COALESCE(SUM(p.area_ha) FILTER (WHERE p.status = 'ACTIVE'), 0) AS area_ha,
                       COUNT(*) FILTER (WHERE p.status = 'ACTIVE' AND EXISTS (
                           SELECT 1 FROM parcel_boundaries b WHERE b.parcel_id = p.id AND b.superseded_at IS NULL)) AS with_boundary
                FROM land_parcels p WHERE 1=1""" + s.sql("p.district_id"), s.params(),
                (rs, i) -> new LandTotals(rs.getLong("active_parcels"), rs.getBigDecimal("area_ha"), rs.getLong("with_boundary")));
    }

    public long documentsPendingVerification(DistrictScope s) {
        return named.queryForObject("""
                SELECT COUNT(*) FROM land_documents d JOIN land_parcels p ON p.id = d.parcel_id
                WHERE d.verification_status = 'PENDING'""" + s.sql("p.district_id"), s.params(), Long.class);
    }

    // ------------------------------------------------------------------ acquisition

    public Map<String, Long> casesByStatus(DistrictScope s) {
        return counts("SELECT c.status, COUNT(*) FROM acquisition_cases c WHERE 1=1" + s.sql("c.district_id") + " GROUP BY c.status ORDER BY c.status", s);
    }

    public AcqParcelTotals acquisitionParcels(DistrictScope s) {
        return named.queryForObject("""
                SELECT COUNT(*) AS parcels, COALESCE(SUM(cp.area_to_acquire_ha), 0) AS area
                FROM case_parcels cp JOIN acquisition_cases c ON c.id = cp.case_id
                WHERE cp.released_at IS NULL AND c.status <> 'CANCELLED'""" + s.sql("c.district_id"), s.params(),
                (rs, i) -> new AcqParcelTotals(rs.getLong("parcels"), rs.getBigDecimal("area")));
    }

    public Map<String, Long> surveysByStatus(DistrictScope s) {
        return counts("SELECT fs.status, COUNT(*) FROM field_surveys fs JOIN acquisition_cases c ON c.id = fs.case_id WHERE 1=1"
                + s.sql("c.district_id") + " GROUP BY fs.status ORDER BY fs.status", s);
    }

    public Map<String, Long> objectionsByStatus(DistrictScope s) {
        return counts("SELECT o.status, COUNT(*) FROM objections o JOIN acquisition_cases c ON c.id = o.case_id WHERE 1=1"
                + s.sql("c.district_id") + " GROUP BY o.status ORDER BY o.status", s);
    }

    public long awardsDeclared(DistrictScope s) {
        return named.queryForObject("SELECT COUNT(*) FROM acquisition_awards a JOIN acquisition_cases c ON c.id = a.case_id WHERE 1=1"
                + s.sql("c.district_id"), s.params(), Long.class);
    }

    public long possessionsRecorded(DistrictScope s) {
        return named.queryForObject("SELECT COUNT(*) FROM possession_records r JOIN acquisition_cases c ON c.id = r.case_id WHERE 1=1"
                + s.sql("c.district_id"), s.params(), Long.class);
    }

    // ------------------------------------------------------------------ compensation (shown only with the right permissions)

    public List<StatusAmount> estimatesByStatus(DistrictScope s) {
        return amounts("SELECT v.status, COUNT(*), COALESCE(SUM(v.total_amount), 0) FROM valuations v JOIN acquisition_cases c ON c.id = v.case_id "
                + "WHERE v.status <> 'SUPERSEDED'" + s.sql("c.district_id") + " GROUP BY v.status ORDER BY v.status", s);
    }

    public List<StatusAmount> paymentsByStatus(DistrictScope s) {
        return amounts("SELECT p.status, COUNT(*), COALESCE(SUM(p.amount), 0) FROM compensation_payments p JOIN acquisition_cases c ON c.id = p.case_id "
                + "WHERE 1=1" + s.sql("c.district_id") + " GROUP BY p.status ORDER BY p.status", s);
    }

    public Map<String, Long> rrCasesByStatus(DistrictScope s) {
        return counts("SELECT r.status, COUNT(*) FROM rr_cases r JOIN acquisition_cases c ON c.id = r.case_id WHERE 1=1"
                + s.sql("c.district_id") + " GROUP BY r.status ORDER BY r.status", s);
    }

    // ------------------------------------------------------------------ trend and districts

    /** The last six months (Asia/Kolkata), oldest first. */
    public List<TrendPoint> trend(DistrictScope s) {
        String sql = """
                SELECT to_char(m, 'YYYY-MM') AS month,
                       (SELECT COUNT(*) FROM proposals p WHERE p.submitted_at IS NOT NULL
                           AND date_trunc('month', p.submitted_at AT TIME ZONE 'Asia/Kolkata') = m %s) AS proposals_submitted,
                       (SELECT COUNT(*) FROM acquisition_cases c
                           WHERE date_trunc('month', c.created_at AT TIME ZONE 'Asia/Kolkata') = m %s) AS cases_opened
                FROM generate_series(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') - interval '5 months',
                                     date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata'), interval '1 month') AS m
                ORDER BY m
                """.formatted(s.sql("p.district_id"), s.sql("c.district_id"));
        return named.query(sql, s.params(), (rs, i) -> new TrendPoint(rs.getString("month"), rs.getLong("proposals_submitted"),
                rs.getLong("cases_opened")));
    }

    /** Districts with any activity inside the scope (at most 500). */
    public List<DistrictRow> districtRows(DistrictScope s) {
        String sql = """
                SELECT * FROM (
                    SELECT d.id, d.name AS district, st.name AS state,
                           (SELECT COUNT(*) FROM projects p WHERE p.district_id = d.id) AS projects,
                           (SELECT COUNT(*) FROM acquisition_cases c WHERE c.district_id = d.id
                               AND c.status NOT IN ('CANCELLED', 'CLOSED')) AS open_cases,
                           (SELECT COUNT(*) FROM land_parcels lp WHERE lp.district_id = d.id AND lp.status = 'ACTIVE') AS parcels,
                           (SELECT COALESCE(SUM(cp.area_to_acquire_ha), 0) FROM case_parcels cp
                               JOIN acquisition_cases c2 ON c2.id = cp.case_id
                               WHERE c2.district_id = d.id AND cp.released_at IS NULL AND c2.status <> 'CANCELLED') AS area_to_acquire
                    FROM districts d JOIN states st ON st.id = d.state_id
                    WHERE 1=1 %s
                ) t WHERE projects > 0 OR open_cases > 0 OR parcels > 0
                ORDER BY state, district LIMIT 500
                """.formatted(s.sql("d.id"));
        return named.query(sql, s.params(), (rs, i) -> new DistrictRow(rs.getObject("id", UUID.class), rs.getString("district"),
                rs.getString("state"), rs.getLong("projects"), rs.getLong("open_cases"), rs.getLong("parcels"),
                rs.getBigDecimal("area_to_acquire")));
    }

    // ------------------------------------------------------------------ helpers

    private Map<String, Long> counts(String sql, DistrictScope s) {
        Map<String, Long> result = new LinkedHashMap<>();
        named.query(sql, s.params(), (RowCallbackHandler) rs -> result.put(rs.getString(1), rs.getLong(2)));
        return result;
    }

    private List<StatusAmount> amounts(String sql, DistrictScope s) {
        return named.query(sql, s.params(), (rs, i) -> new StatusAmount(rs.getString(1), rs.getLong(2), rs.getBigDecimal(3)));
    }
}