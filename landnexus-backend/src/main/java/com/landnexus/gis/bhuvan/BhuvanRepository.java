package com.landnexus.gis.bhuvan;

import com.landnexus.gis.bhuvan.BhuvanDtos.HistoryItem;
import com.landnexus.gis.bhuvan.BhuvanDtos.HistoryPage;
import com.landnexus.shared.exception.InvalidRequestException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** PostGIS and history access for the Bhuvan AOI analysis. Inputs are bind parameters, never concatenated SQL. */
@Repository
public class BhuvanRepository {

    public record Aoi(String wkt, BigDecimal areaHa, String source, String providerGeometryType) {
    }

    public record ProjectGeography(String projectCode, String stateCode, String stateName, String districtName) {
    }

    public record StoredRun(UUID id, UUID projectId, String projectCode, String stateCode, String stateName,
                            String districtName, String aoiSource, BigDecimal aoiAreaHa, String status, String message,
                            int recordCount, BigDecimal totalAreaSqKm, String requestedBy, Instant createdAt,
                            String responseJson) {
    }

    private final JdbcTemplate jdbc;

    public BhuvanRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------ AOI

    /** The project's current corridor, made into one Polygon because that is what the Bhuvan AOI endpoint accepts. */
    public Optional<Aoi> projectCorridorAoi(UUID projectId) {
        return jdbc.query("""
                WITH c AS (
                    SELECT ST_Buffer(a.geom::geography, (a.corridor_width_m / 2.0)::float8)::geometry AS g
                    FROM project_alignments a
                    WHERE a.project_id = ?::uuid AND a.superseded_at IS NULL
                )
                SELECT GeometryType(g) AS type,
                       ROUND((ST_Area(g::geography) / 10000.0)::numeric, 4) AS area_ha,
                       ST_AsText(CASE WHEN GeometryType(g) = 'POLYGON' THEN g ELSE ST_ConvexHull(g) END) AS wkt
                FROM c
                """, (rs, i) -> new Aoi(rs.getString("wkt"), rs.getBigDecimal("area_ha"),
                "POLYGON".equals(rs.getString("type")) ? "PROJECT_CORRIDOR" : "PROJECT_CORRIDOR_CONVEX_HULL",
                rs.getString("type")), projectId).stream().findFirst();
    }

    /**
     * Validates a WKT geometry with PostGIS. A MultiPolygon is reduced to its convex hull so the provider receives one
     * Polygon. The returned area is the area of the geometry the user supplied, before that reduction.
     */
    public Aoi normaliseWkt(String wkt) {
        record Inspection(String type, boolean valid, String reason, double xmin, double xmax, double ymin, double ymax,
                          BigDecimal areaHa, String stored) {
        }
        Inspection in;
        try {
            in = jdbc.queryForObject("""
                    SELECT GeometryType(g) AS type, ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason,
                           ST_XMin(g) AS xmin, ST_XMax(g) AS xmax, ST_YMin(g) AS ymin, ST_YMax(g) AS ymax,
                           ROUND((ST_Area(g::geography) / 10000.0)::numeric, 4) AS area_ha,
                           ST_AsText(g) AS stored
                    FROM (SELECT ST_SetSRID(ST_GeomFromText(?::text), 4326) AS g) t
                    """, (rs, i) -> new Inspection(rs.getString("type"), rs.getBoolean("valid"), rs.getString("reason"),
                    rs.getDouble("xmin"), rs.getDouble("xmax"), rs.getDouble("ymin"), rs.getDouble("ymax"),
                    rs.getBigDecimal("area_ha"), rs.getString("stored")), wkt);
        } catch (DataAccessException e) {
            throw new InvalidRequestException("The AOI is not a valid WKT geometry");
        }
        if (in == null || !in.valid()) {
            throw new InvalidRequestException("The AOI is not valid: " + (in == null ? "unknown reason" : in.reason()));
        }
        if (!"POLYGON".equals(in.type()) && !"MULTIPOLYGON".equals(in.type())) {
            throw new InvalidRequestException("The AOI must be a WKT Polygon or MultiPolygon");
        }
        if (in.xmin() < 68.0 || in.xmax() > 97.5 || in.ymin() < 6.0 || in.ymax() > 37.6) {
            throw new InvalidRequestException("The AOI must lie inside India: check the longitude and latitude order");
        }
        if (in.areaHa() == null || in.areaHa().signum() <= 0) {
            throw new InvalidRequestException("The AOI has no area");
        }
        if ("POLYGON".equals(in.type())) {
            return new Aoi(in.stored(), in.areaHa(), "USER_WKT", in.type());
        }
        String hull = jdbc.queryForObject("""
                SELECT ST_AsText(ST_ConvexHull(g)) FROM (SELECT ST_SetSRID(ST_GeomFromText(?::text), 4326) AS g) t
                """, String.class, wkt);
        return new Aoi(hull, in.areaHa(), "USER_WKT_CONVEX_HULL", in.type());
    }

    public Optional<ProjectGeography> projectGeography(UUID projectId) {
        return jdbc.query("""
                SELECT p.code AS project_code, s.code AS state_code, s.name AS state_name, d.name AS district_name
                FROM projects p
                JOIN states s ON s.id = p.state_id
                LEFT JOIN districts d ON d.id = p.district_id
                WHERE p.id = ?::uuid
                """, (rs, i) -> new ProjectGeography(rs.getString("project_code"), rs.getString("state_code"),
                rs.getString("state_name"), rs.getString("district_name")), projectId).stream().findFirst();
    }

    // ------------------------------------------------------------------ history

    public UUID insertRun(UUID projectId, String projectCode, String stateCode, String stateName, String districtName,
                          String aoiSource, BigDecimal aoiAreaHa, String aoiWkt, String status, String message,
                          int recordCount, BigDecimal totalAreaSqKm, String responseJson, UUID userId, String username) {
        return jdbc.queryForObject("""
                INSERT INTO bhuvan_lulc_analyses (project_id, project_code, state_code, state_name, district_name, aoi_source,
                       aoi_area_ha, aoi_wkt, status, message, record_count, total_area_sq_km, response_json,
                       requested_by_user_id, requested_by_username)
                VALUES (?::uuid, ?::text, ?::text, ?::text, ?::text, ?::text, ?::numeric, ?::text, ?::text, ?::text,
                        ?::int, ?::numeric, ?::jsonb, ?::uuid, ?::text)
                RETURNING id
                """, UUID.class, projectId, projectCode, stateCode, stateName, districtName, aoiSource, aoiAreaHa,
                aoiWkt, status, message, recordCount, totalAreaSqKm, responseJson == null ? "null" : responseJson,
                userId, username);
    }

    public HistoryPage history(UUID projectId, int page, int size) {
        String where = projectId == null ? "" : " WHERE project_id = ?::uuid";
        Object[] filter = projectId == null ? new Object[0] : new Object[] {projectId};
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM bhuvan_lulc_analyses" + where, Long.class, filter);
        Object[] args = projectId == null
                ? new Object[] {size, (long) page * size}
                : new Object[] {projectId, size, (long) page * size};
        List<HistoryItem> items = jdbc.query("""
                SELECT id, project_id, project_code, state_code, state_name, district_name, aoi_source, aoi_area_ha,
                       status, message, record_count, total_area_sq_km, requested_by_username, created_at,
                       response_json IS NOT NULL AND response_json::text <> 'null' AS result_available
                FROM bhuvan_lulc_analyses
                """ + where + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                (rs, i) -> new HistoryItem(rs.getObject("id", UUID.class), rs.getObject("project_id", UUID.class),
                        rs.getString("project_code"), rs.getString("state_code"), rs.getString("state_name"),
                        rs.getString("district_name"), rs.getString("aoi_source"), rs.getBigDecimal("aoi_area_ha"),
                        rs.getString("status"), rs.getString("message"), rs.getInt("record_count"),
                        rs.getBigDecimal("total_area_sq_km"), rs.getString("requested_by_username"),
                        rs.getTimestamp("created_at").toInstant(), rs.getBoolean("result_available")), args);
        long count = total == null ? 0 : total;
        int pages = size <= 0 ? 0 : (int) Math.ceil(count / (double) size);
        return new HistoryPage(items, page, size, count, pages);
    }

    public Optional<StoredRun> findRun(UUID id) {
        return jdbc.query("""
                SELECT id, project_id, project_code, state_code, state_name, district_name, aoi_source, aoi_area_ha,
                       status, message, record_count, total_area_sq_km, requested_by_username, created_at,
                       response_json::text AS response_json
                FROM bhuvan_lulc_analyses WHERE id = ?::uuid
                """, (rs, i) -> new StoredRun(rs.getObject("id", UUID.class), rs.getObject("project_id", UUID.class),
                rs.getString("project_code"), rs.getString("state_code"), rs.getString("state_name"),
                rs.getString("district_name"), rs.getString("aoi_source"), rs.getBigDecimal("aoi_area_ha"),
                rs.getString("status"), rs.getString("message"), rs.getInt("record_count"),
                rs.getBigDecimal("total_area_sq_km"), rs.getString("requested_by_username"),
                rs.getTimestamp("created_at").toInstant(), rs.getString("response_json")), id).stream().findFirst();
    }

    public Optional<String> findAoiWkt(UUID id) {
        return jdbc.query("SELECT aoi_wkt FROM bhuvan_lulc_analyses WHERE id = ?::uuid",
                (rs, i) -> rs.getString(1), id).stream().findFirst();
    }
}
