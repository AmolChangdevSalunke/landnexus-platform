package com.landnexus.reporting.infrastructure;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Runs a report against one of the rpt_* views. The view, the columns and the order are constants chosen by the caller
 * from a fixed catalogue; filter values are bind parameters.
 */
@Repository
public class ReportRepository {

    public record RowPage(List<Map<String, Object>> rows, long total) {
    }

    private final NamedParameterJdbcTemplate named;

    public ReportRepository(NamedParameterJdbcTemplate named) {
        this.named = named;
    }

    public RowPage run(String view, List<String> columns, String statusColumn, String status, DistrictScope scope,
                       String orderBy, int limit, int offset) {
        String where = " WHERE 1=1" + scope.sql("district_id") + (status == null ? "" : " AND " + statusColumn + " = :status");
        Map<String, Object> params = new HashMap<>(scope.params());
        if (status != null) {
            params.put("status", status);
        }
        Long total = named.queryForObject("SELECT COUNT(*) FROM " + view + where, params, Long.class);
        params.put("limit", limit);
        params.put("offset", offset);
        List<Map<String, Object>> rows = named.query("SELECT " + String.join(", ", columns) + " FROM " + view + where
                + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset", params, (rs, i) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            for (String column : columns) {
                row.put(column, normalize(rs.getObject(column)));
            }
            return row;
        });
        return new RowPage(rows, total == null ? 0 : total);
    }

    /** Dates and times as ISO text so JSON and CSV agree; numbers stay numbers. */
    private static Object normalize(Object value) {
        if (value instanceof Timestamp t) {
            return t.toInstant().toString();
        }
        if (value instanceof java.sql.Date d) {
            return d.toLocalDate().toString();
        }
        if (value instanceof OffsetDateTime o) {
            return o.toInstant().toString();
        }
        return value;
    }
}