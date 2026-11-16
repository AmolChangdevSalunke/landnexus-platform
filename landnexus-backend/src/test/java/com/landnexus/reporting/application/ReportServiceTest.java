package com.landnexus.reporting.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.ReportRepository;
import com.landnexus.reporting.infrastructure.ReportRepository.RowPage;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.security.CurrentActor;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock private ReportRepository repository;
    @Mock private ReportingScope scopes;
    @Mock private AuditService audit;

    private final CurrentActor actor = new CurrentActor(UUID.randomUUID(), "reporter", Set.of("REPORT_READ"));
    private final DistrictScope scope = DistrictScope.all();
    private ReportService service;

    @BeforeEach
    void setUp() {
        service = new ReportService(repository, scopes, audit, java.time.Clock.systemUTC());
    }

    @Test
    void runPassesBoundReportDimensionsToTheRepository() {
        UUID districtId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID talukaId = UUID.randomUUID();
        LocalDate from = LocalDate.parse("2026-01-01");
        LocalDate to = LocalDate.parse("2026-06-30");
        when(scopes.resolve(actor, null, districtId)).thenReturn(scope);
        when(repository.run(eq("rpt_projects"), anyList(), eq("status"), isNull(), eq("approved_at"),
                eq("project_id"), eq("taluka_ids"), eq(from), eq(to), eq(projectId), eq(talukaId), eq(scope),
                eq("approved_at DESC NULLS LAST, id"), eq(25), eq(50)))
                .thenReturn(new RowPage(List.<Map<String, Object>>of(), 0));

        var result = service.run("PROJECTS", null, null, districtId, talukaId, projectId, from, to, 2, 25, actor);

        assertThat(result.page()).isEqualTo(2);
        assertThat(result.size()).isEqualTo(25);
        assertThat(result.totalRows()).isZero();
        verify(repository).run(eq("rpt_projects"), anyList(), eq("status"), isNull(), eq("approved_at"),
                eq("project_id"), eq("taluka_ids"), eq(from), eq(to), eq(projectId), eq(talukaId), eq(scope),
                eq("approved_at DESC NULLS LAST, id"), eq(25), eq(50));
    }

    @Test
    void runRejectsReversedDateRangeBeforeQuerying() {
        assertThatThrownBy(() -> service.run("PROJECTS", null, null, null, null, null,
                LocalDate.parse("2026-06-30"), LocalDate.parse("2026-01-01"), 0, 50, actor))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("fromDate");
        verifyNoInteractions(repository);
    }
}
