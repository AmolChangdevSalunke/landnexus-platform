package com.landnexus.gis.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Read-only reporting queries for the conflict report and the project map. They read tables of other modules
 * (land_parcels, case_parcels, acquisition_cases, field_surveys, project_villages) on purpose, because a spatial join
 * has to happen in the database. They never write. Every value is a bind parameter.
 */
@Repository
public class GisReportRepository {

    public record AlignmentMeta(int versionNo, int corridorWidthM, BigDecimal corridorAreaHa) {
    }

    public record AffectedParcel(UUID parcelId, String gatNumber, String surveyNumber, String classification, String landUse,
                                 BigDecimal recordedAreaHa, BigDecimal boundaryAreaHa, BigDecimal affectedHa,
                                 UUID caseProjectId, String caseNumber, BigDecimal areaToAcquireHa) {
    }

    public record CaseParcelCheck(UUID parcelId, String caseNumber, String label, boolean hasBoundary, boolean crossesCorridor) {
    }

    public record Overlap(UUID parcelA, UUID parcelB, BigDecimal overlapHa) {
    }

    public record SurveyPoint(UUID surveyId, UUID parcelId, String caseNumber, boolean inside, BigDecimal distanceM) {
    }

    public record Coverage(long total, long withBoundary) {
    }

    private static final String CORRIDOR = """
            corridor AS (
                SELECT ST_Buffer(a.geom::geography, (a.corridor_width_m / 2.0)::float8)::geometry AS g
                FROM project_alignments a WHERE a.project_id = ?::uuid AND a.superseded_at IS NULL)
            """;

    private final JdbcTemplate jdbc;

    public GisReportRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<AlignmentMeta> alignmentMeta(UUID projectId) {
        return jdbc.query("""
                SELECT version_no, corridor_width_m,
                       ROUND((ST_Area(ST_Buffer(geom::geography, (corridor_width_m / 2.0)::float8)) / 10000.0)::numeric, 4) AS area_ha
                FROM project_alignments WHERE project_id = ?::uuid AND superseded_at IS NULL
                """, (rs, i) -> new AlignmentMeta(rs.getInt("version_no"), rs.getInt("corridor_width_m"), rs.getBigDecimal("area_ha")),
                projectId).stream().findFirst();
    }

    /** Parcels whose current boundary really overlaps the corridor (touching only is ignored), with the overlapped area. */
    public List<AffectedParcel> affectedParcels(UUID projectId, UUID districtId) {
        return jdbc.query("WITH " + CORRIDOR + """
                SELECT p.id, p.gat_number, p.survey_number, p.classification, p.land_use, p.area_ha AS recorded_ha,
                       b.area_ha AS boundary_ha, x.affected_ha, k.project_id AS case_project_id, k.case_number, k.area_to_acquire_ha
                FROM parcel_boundaries b
                JOIN land_parcels p ON p.id = b.parcel_id
                CROSS JOIN corridor c
                CROSS JOIN LATERAL (SELECT ROUND((ST_Area(ST_CollectionExtract(ST_Intersection(b.geom, c.g), 3)::geography) / 10000.0)::numeric, 4) AS affected_ha) x
                LEFT JOIN LATERAL (SELECT ac.project_id, ac.case_number, cp.area_to_acquire_ha
                                   FROM case_parcels cp JOIN acquisition_cases ac ON ac.id = cp.case_id
                                   WHERE cp.parcel_id = p.id AND cp.released_at IS NULL LIMIT 1) k ON TRUE
                WHERE b.superseded_at IS NULL AND p.district_id = ?::uuid AND ST_Intersects(b.geom, c.g) AND x.affected_ha > 0
                ORDER BY p.gat_number NULLS LAST, p.survey_number
                LIMIT 5000
                """, (rs, i) -> new AffectedParcel(rs.getObject("id", UUID.class), rs.getString("gat_number"),
                        rs.getString("survey_number"), rs.getString("classification"), rs.getString("land_use"),
                        rs.getBigDecimal("recorded_ha"), rs.getBigDecimal("boundary_ha"), rs.getBigDecimal("affected_ha"),
                        rs.getObject("case_project_id", UUID.class), rs.getString("case_number"), rs.getBigDecimal("area_to_acquire_ha")),
                projectId, districtId);
    }

    /** The parcels of this project's open cases: do they have a boundary, and does it cross the corridor? */
    public List<CaseParcelCheck> caseParcelChecks(UUID projectId) {
        return jdbc.query("WITH " + CORRIDOR + """
                SELECT cp.parcel_id, ac.case_number, COALESCE(p.gat_number, p.survey_number) AS label,
                       b.parcel_id IS NOT NULL AS has_boundary,
                       COALESCE(ST_Intersects(b.geom, (SELECT g FROM corridor)), FALSE) AS crosses
                FROM case_parcels cp
                JOIN acquisition_cases ac ON ac.id = cp.case_id
                JOIN land_parcels p ON p.id = cp.parcel_id
                LEFT JOIN parcel_boundaries b ON b.parcel_id = cp.parcel_id AND b.superseded_at IS NULL
                WHERE ac.project_id = ?::uuid AND cp.released_at IS NULL
                ORDER BY ac.case_number, label
                """, (rs, i) -> new CaseParcelCheck(rs.getObject("parcel_id", UUID.class), rs.getString("case_number"),
                rs.getString("label"), rs.getBoolean("has_boundary"), rs.getBoolean("crosses")), projectId, projectId);
    }

    /** Pairs of parcels crossing the corridor whose boundaries overlap each other by at least one square metre. */
    public List<Overlap> overlaps(UUID projectId, UUID districtId) {
        return jdbc.query("WITH " + CORRIDOR + """
                , hit AS (
                    SELECT b.parcel_id, b.geom FROM parcel_boundaries b
                    JOIN land_parcels p ON p.id = b.parcel_id CROSS JOIN corridor c
                    WHERE b.superseded_at IS NULL AND p.district_id = ?::uuid AND ST_Intersects(b.geom, c.g) LIMIT 2000)
                SELECT o.a, o.b, o.overlap_ha FROM (
                    SELECT x.parcel_id AS a, y.parcel_id AS b,
                           ROUND((ST_Area(ST_CollectionExtract(ST_Intersection(x.geom, y.geom), 3)::geography) / 10000.0)::numeric, 4) AS overlap_ha
                    FROM hit x JOIN hit y ON x.parcel_id < y.parcel_id AND ST_Intersects(x.geom, y.geom)) o
                WHERE o.overlap_ha >= 0.0001 ORDER BY o.overlap_ha DESC LIMIT 200
                """, (rs, i) -> new Overlap(rs.getObject("a", UUID.class), rs.getObject("b", UUID.class), rs.getBigDecimal("overlap_ha")),
                projectId, districtId);
    }

    /** Distance of each live survey's GPS point from the boundary of its parcel (0 when inside). */
    public List<SurveyPoint> surveyPoints(UUID projectId) {
        return jdbc.query("""
                SELECT s.id, cp.parcel_id, ac.case_number, ST_Intersects(b.geom, pt.g) AS inside,
                       ROUND(ST_Distance(b.geom::geography, pt.g::geography)::numeric, 1) AS distance_m
                FROM field_surveys s
                JOIN case_parcels cp ON cp.id = s.case_parcel_id
                JOIN acquisition_cases ac ON ac.id = s.case_id
                JOIN parcel_boundaries b ON b.parcel_id = cp.parcel_id AND b.superseded_at IS NULL
                CROSS JOIN LATERAL (SELECT ST_SetSRID(ST_MakePoint(s.gps_longitude::float8, s.gps_latitude::float8), 4326) AS g) pt
                WHERE ac.project_id = ?::uuid AND s.status <> 'REJECTED'
                ORDER BY ac.case_number, s.created_at
                LIMIT 2000
                """, (rs, i) -> new SurveyPoint(rs.getObject("id", UUID.class), rs.getObject("parcel_id", UUID.class),
                rs.getString("case_number"), rs.getBoolean("inside"), rs.getBigDecimal("distance_m")), projectId);
    }

    public Coverage coverage(UUID projectId) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS total, COUNT(b.parcel_id) AS with_boundary
                FROM land_parcels p
                JOIN project_villages pv ON pv.village_id = p.village_id
                LEFT JOIN parcel_boundaries b ON b.parcel_id = p.id AND b.superseded_at IS NULL
                WHERE pv.project_id = ?::uuid AND p.status = 'ACTIVE'
                """, (rs, i) -> new Coverage(rs.getLong("total"), rs.getLong("with_boundary")), projectId);
    }

    /** One FeatureCollection: the corridor, the alignment and the parcels crossing the corridor (at most 2000). */
    public String mapFeatureCollection(UUID projectId, UUID districtId) {
        return jdbc.queryForObject("WITH " + CORRIDOR + """
                , feats AS (
                    SELECT jsonb_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(c.g, 7)::jsonb,
                           'properties', jsonb_build_object('kind', 'CORRIDOR')) AS f
                    FROM corridor c
                    UNION ALL
                    SELECT jsonb_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(a.geom, 7)::jsonb,
                           'properties', jsonb_build_object('kind', 'ALIGNMENT', 'lengthKm', a.length_km))
                    FROM project_alignments a WHERE a.project_id = ?::uuid AND a.superseded_at IS NULL
                    UNION ALL
                    (SELECT jsonb_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(b.geom, 7)::jsonb,
                            'properties', jsonb_build_object('kind', 'PARCEL', 'parcelId', b.parcel_id, 'gatNumber', p.gat_number,
                                'surveyNumber', p.survey_number, 'classification', p.classification, 'landUse', p.land_use,
                                'areaHa', b.area_ha,
                                'inCase', EXISTS (SELECT 1 FROM case_parcels cp WHERE cp.parcel_id = b.parcel_id AND cp.released_at IS NULL)))
                     FROM parcel_boundaries b JOIN land_parcels p ON p.id = b.parcel_id CROSS JOIN corridor c
                     WHERE b.superseded_at IS NULL AND p.district_id = ?::uuid AND ST_Intersects(b.geom, c.g)
                     LIMIT 2000))
                SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(f), '[]'::jsonb))::text FROM feats
                """, String.class, projectId, projectId, districtId);
    }
}