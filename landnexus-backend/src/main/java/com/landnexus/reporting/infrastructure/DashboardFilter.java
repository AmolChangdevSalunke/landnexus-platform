package com.landnexus.reporting.infrastructure;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

/** Fixed dashboard dimensions; values are always bound and the geographic scope is resolved by ReportingScope. */
public record DashboardFilter(DistrictScope districts, UUID projectId, UUID talukaId,
                              LocalDate fromDate, LocalDate toDate, String proposalStatus,
                              String projectStatus, String acquisitionStatus) {

    public DashboardFilter(DistrictScope districts, UUID projectId, UUID talukaId, LocalDate fromDate, LocalDate toDate) {
        this(districts, projectId, talukaId, fromDate, toDate, null, null, null);
    }

    public String statusSql(String column, String parameter) {
        return switch (parameter) {
            case "proposalStatus" -> proposalStatus == null ? "" : " AND " + column + " = :proposalStatus";
            case "projectStatus" -> projectStatus == null ? "" : " AND " + column + " = :projectStatus";
            case "acquisitionStatus" -> acquisitionStatus == null ? "" : " AND " + column + " = :acquisitionStatus";
            default -> throw new IllegalArgumentException("Unknown dashboard status parameter");
        };
    }

    public String sql(String districtColumn, String dateColumn, String projectCondition, String talukaCondition) {
        StringBuilder where = new StringBuilder(districts.sql(districtColumn));
        if (fromDate != null) {
            where.append(" AND DATE(").append(dateColumn)
                    .append(" AT TIME ZONE 'Asia/Kolkata') >= :fromDate");
        }
        if (toDate != null) {
            where.append(" AND DATE(").append(dateColumn)
                    .append(" AT TIME ZONE 'Asia/Kolkata') <= :toDate");
        }
        if (projectId != null) {
            where.append(" AND ").append(projectCondition);
        }
        if (talukaId != null) {
            where.append(" AND ").append(talukaCondition);
        }
        return where.toString();
    }

    public Map<String, Object> params() {
        MapSqlParameterSource params = new MapSqlParameterSource(districts.params());
        params.addValue("projectId", projectId);
        params.addValue("talukaId", talukaId);
        params.addValue("fromDate", fromDate);
        params.addValue("toDate", toDate);
        params.addValue("proposalStatus", proposalStatus);
        params.addValue("projectStatus", projectStatus);
        params.addValue("acquisitionStatus", acquisitionStatus);
        return params.getValues();
    }
}
