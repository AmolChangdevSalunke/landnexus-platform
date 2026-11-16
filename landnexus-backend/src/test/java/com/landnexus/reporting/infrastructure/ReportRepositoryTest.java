package com.landnexus.reporting.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@ExtendWith(MockitoExtension.class)
class ReportRepositoryTest {

    @Mock private NamedParameterJdbcTemplate named;

    @Test
    void runUsesBoundDateProjectAndTalukaFilters() {
        ReportRepository repository = new ReportRepository(named);
        UUID projectId = UUID.randomUUID();
        UUID talukaId = UUID.randomUUID();
        LocalDate from = LocalDate.parse("2026-01-01");
        LocalDate to = LocalDate.parse("2026-06-30");
        when(named.queryForObject(anyString(), org.mockito.ArgumentMatchers.<Map<String, ?>>any(), eq(Long.class)))
                .thenReturn(1L);
        when(named.query(anyString(), org.mockito.ArgumentMatchers.<Map<String, ?>>any(),
                org.mockito.ArgumentMatchers.<RowMapper<Map<String, Object>>>any())).thenReturn(List.of());

        repository.run("rpt_projects", List.of("id"), "status", "ACTIVE", "approved_at", "project_id", "taluka_ids",
                from, to, projectId, talukaId, DistrictScope.all(), "id", 10, 0);

        ArgumentCaptor<String> query = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Map<String, ?>> parameters = ArgumentCaptor.forClass(Map.class);
        verify(named).queryForObject(query.capture(), parameters.capture(), eq(Long.class));
        assertThat(query.getValue()).contains(
                "status = :status",
                "DATE(approved_at AT TIME ZONE 'Asia/Kolkata') >= :fromDate",
                "DATE(approved_at AT TIME ZONE 'Asia/Kolkata') <= :toDate",
                "project_id = :projectId",
                ":talukaId = ANY(taluka_ids)");
        assertThat(parameters.getValue().get("status")).isEqualTo("ACTIVE");
        assertThat(parameters.getValue().get("fromDate")).isEqualTo(from);
        assertThat(parameters.getValue().get("toDate")).isEqualTo(to);
        assertThat(parameters.getValue().get("projectId")).isEqualTo(projectId);
        assertThat(parameters.getValue().get("talukaId")).isEqualTo(talukaId);
    }
}
