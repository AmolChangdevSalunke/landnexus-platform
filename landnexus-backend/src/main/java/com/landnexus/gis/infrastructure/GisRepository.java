package com.landnexus.gis.infrastructure;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * All PostGIS access. The geometry never becomes a Java object: it goes in and out as GeoJSON text and PostGIS does the
 * parsing, validation and measuring. Every value is a bind parameter (no string concatenation of user input).
 */
@Repository
public class GisRepository {

    /** What PostGIS says about a submitted geometry. areaHa and lengthKm are null when it is invalid or out of range. */
    public record Inspection(boolean valid, String reason, String type, int coordDim, int points, double xMin, double xMax,
                             double yMin, double yMax, BigDecimal areaHa, BigDecimal lengthKm) {
    }

    /** measure = area in hectares (parcel) or length in km (alignment). */
    public record VersionRow(int versionNo, BigDecimal measure, Integer corridorWidthM, int vertices, String sourceNote,
                             String enteredBy, Instant enteredAt, boolean current) {
    }

    private static final String INSPECT = """
            SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason, GeometryType(g) AS type, ST_CoordDim(g) AS dim,
                   ST_NPoints(g) AS points, ST_XMin(g) AS xmin, ST_XMax(g) AS xmax, ST_YMin(g) AS ymin, ST_YMax(g) AS ymax,
                   CASE WHEN ST_IsValid(g) AND ST_XMin(g) >= -180 AND ST_XMax(g) <= 180 AND ST_YMin(g) >= -90 AND ST_YMax(g) <= 90
                        THEN ROUND((ST_Area(g::geography) / 10000.0)::numeric, 4) END AS area_ha,
                   CASE WHEN ST_IsValid(g) AND ST_XMin(g) >= -180 AND ST_XMax(g) <= 180 AND ST_YMin(g) >= -90 AND ST_YMax(g) <= 90
                        THEN ROUND((ST_Length(g::geography) / 1000.0)::numeric, 3) END AS length_km
            FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(?::text), 4326) AS g) t
            """;

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    public GisRepository(JdbcTemplate jdbc, NamedParameterJdbcTemplate named) {
        this.jdbc = jdbc;
        this.named = named;
    }

    public Inspection inspect(String geoJson) {
        return jdbc.queryForObject(INSPECT, (rs, i) -> new Inspection(rs.getBoolean("valid"), rs.getString("reason"),
                rs.getString("type"), rs.getInt("dim"), rs.getInt("points"), rs.getDouble("xmin"), rs.getDouble("xmax"),
                rs.getDouble("ymin"), rs.getDouble("ymax"), rs.getBigDecimal("area_ha"), rs.getBigDecimal("length_km")), geoJson);
    }

    // ------------------------------------------------------------------ parcel boundaries

    public int nextBoundaryVersion(UUID parcelId) {
        return jdbc.queryForObject("SELECT COALESCE(MAX(version_no), 0) + 1 FROM parcel_boundaries WHERE parcel_id = ?::uuid",
                Integer.class, parcelId);
    }

    public void supersedeBoundary(UUID parcelId) {
        jdbc.update("UPDATE parcel_boundaries SET superseded_at = now() WHERE parcel_id = ?::uuid AND superseded_at IS NULL", parcelId);
    }

    /** Stores the geometry as a MultiPolygon and returns the area in hectares (4 decimals). */
    public BigDecimal insertBoundary(UUID parcelId, int version, String geoJson, String note, UUID userId, String username) {
        return jdbc.queryForObject("""
                INSERT INTO parcel_boundaries (parcel_id, version_no, geom, area_ha, vertices, source_note, entered_by_user_id, entered_by_username)
                SELECT ?::uuid, ?::int, ST_Multi(g), ROUND((ST_Area(g::geography) / 10000.0)::numeric, 4), ST_NPoints(g), ?::text, ?::uuid, ?::text
                FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(?::text), 4326) AS g) t
                RETURNING area_ha
                """, BigDecimal.class, parcelId, version, note, userId, username, geoJson);
    }

    public Optional<String> currentBoundaryFeature(UUID parcelId) {
        return jdbc.query("""
                SELECT jsonb_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(geom, 7)::jsonb,
                       'properties', jsonb_build_object('parcelId', parcel_id, 'versionNo', version_no, 'areaHa', area_ha,
                                                        'sourceNote', source_note))::text
                FROM parcel_boundaries WHERE parcel_id = ?::uuid AND superseded_at IS NULL
                """, (rs, i) -> rs.getString(1), parcelId).stream().findFirst();
    }

    public List<VersionRow> boundaryVersions(UUID parcelId) {
        return jdbc.query("""
                SELECT version_no, area_ha, vertices, source_note, entered_by_username, entered_at, superseded_at IS NULL AS current
                FROM parcel_boundaries WHERE parcel_id = ?::uuid ORDER BY version_no DESC
                """, (rs, i) -> new VersionRow(rs.getInt("version_no"), rs.getBigDecimal("area_ha"), null, rs.getInt("vertices"),
                rs.getString("source_note"), rs.getString("entered_by_username"), rs.getTimestamp("entered_at").toInstant(),
                rs.getBoolean("current")), parcelId);
    }

    /** One FeatureCollection with the current boundary of each given parcel (properties: parcelId, versionNo, areaHa). */
    public String parcelsFeatureCollection(Collection<UUID> parcelIds) {
        if (parcelIds.isEmpty()) {
            return "{\"type\":\"FeatureCollection\",\"features\":[]}";
        }
        return named.queryForObject("""
                SELECT jsonb_build_object('type', 'FeatureCollection', 'features', COALESCE(jsonb_agg(jsonb_build_object(
                       'type', 'Feature', 'geometry', ST_AsGeoJSON(b.geom, 7)::jsonb,
                       'properties', jsonb_build_object('parcelId', b.parcel_id, 'versionNo', b.version_no, 'areaHa', b.area_ha))), '[]'::jsonb))::text
                FROM parcel_boundaries b WHERE b.superseded_at IS NULL AND b.parcel_id IN (:ids)
                """, new MapSqlParameterSource("ids", parcelIds), String.class);
    }

    // ------------------------------------------------------------------ project alignments

    public int nextAlignmentVersion(UUID projectId) {
        return jdbc.queryForObject("SELECT COALESCE(MAX(version_no), 0) + 1 FROM project_alignments WHERE project_id = ?::uuid",
                Integer.class, projectId);
    }

    public void supersedeAlignment(UUID projectId) {
        jdbc.update("UPDATE project_alignments SET superseded_at = now() WHERE project_id = ?::uuid AND superseded_at IS NULL", projectId);
    }

    /** Stores the line as a MultiLineString and returns its length in km (3 decimals). */
    public BigDecimal insertAlignment(UUID projectId, int version, String geoJson, int widthM, String note, UUID userId, String username) {
        return jdbc.queryForObject("""
                INSERT INTO project_alignments (project_id, version_no, geom, length_km, corridor_width_m, vertices, source_note, entered_by_user_id, entered_by_username)
                SELECT ?::uuid, ?::int, ST_Multi(g), ROUND((ST_Length(g::geography) / 1000.0)::numeric, 3), ?::int, ST_NPoints(g), ?::text, ?::uuid, ?::text
                FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(?::text), 4326) AS g) t
                RETURNING length_km
                """, BigDecimal.class, projectId, version, widthM, note, userId, username, geoJson);
    }

    public Optional<String> currentAlignmentFeature(UUID projectId) {
        return jdbc.query("""
                SELECT jsonb_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(geom, 7)::jsonb,
                       'properties', jsonb_build_object('projectId', project_id, 'versionNo', version_no, 'lengthKm', length_km,
                                                        'corridorWidthM', corridor_width_m, 'kind', 'ALIGNMENT'))::text
                FROM project_alignments WHERE project_id = ?::uuid AND superseded_at IS NULL
                """, (rs, i) -> rs.getString(1), projectId).stream().findFirst();
    }

    /** The corridor: the alignment widened by half the corridor width on each side, measured in metres on the ground. */
    public Optional<String> currentCorridorFeature(UUID projectId) {
        return jdbc.query("""
                SELECT jsonb_build_object('type', 'Feature',
                       'geometry', ST_AsGeoJSON(ST_Buffer(geom::geography, (corridor_width_m / 2.0)::float8)::geometry, 7)::jsonb,
                       'properties', jsonb_build_object('projectId', project_id, 'versionNo', version_no,
                                                        'corridorWidthM', corridor_width_m, 'kind', 'CORRIDOR'))::text
                FROM project_alignments WHERE project_id = ?::uuid AND superseded_at IS NULL
                """, (rs, i) -> rs.getString(1), projectId).stream().findFirst();
    }

    public List<VersionRow> alignmentVersions(UUID projectId) {
        return jdbc.query("""
                SELECT version_no, length_km, corridor_width_m, vertices, source_note, entered_by_username, entered_at, superseded_at IS NULL AS current
                FROM project_alignments WHERE project_id = ?::uuid ORDER BY version_no DESC
                """, (rs, i) -> new VersionRow(rs.getInt("version_no"), rs.getBigDecimal("length_km"), rs.getInt("corridor_width_m"),
                rs.getInt("vertices"), rs.getString("source_note"), rs.getString("entered_by_username"),
                rs.getTimestamp("entered_at").toInstant(), rs.getBoolean("current")), projectId);
    }
}