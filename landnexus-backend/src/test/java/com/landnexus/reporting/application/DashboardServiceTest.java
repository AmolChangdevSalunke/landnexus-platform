package com.landnexus.reporting.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

import com.landnexus.reporting.api.dto.MonitoringDtos.Dashboard;
import com.landnexus.reporting.api.dto.MonitoringDtos.StatusAmount;
import com.landnexus.reporting.infrastructure.DashboardRepository;
import com.landnexus.reporting.infrastructure.DashboardRepository.AcqParcelTotals;
import com.landnexus.reporting.infrastructure.DashboardRepository.LandTotals;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.DashboardFilter;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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
class DashboardServiceTest {

    @Mock private DashboardRepository repo;
    @Mock private ReportingScope scopes;

    private DashboardService service;

    private static CurrentActor actor(String... permissions) {
        return new CurrentActor(UUID.randomUUID(), "user", Set.of("AUDITOR"), Set.of(permissions));
    }

    @BeforeEach
    void setUp() {
        service = new DashboardService(repo, scopes, Clock.fixed(Instant.parse("2026-11-08T10:00:00Z"), ZoneOffset.UTC));
        lenient().when(scopes.resolve(any(), any(), any())).thenReturn(DistrictScope.all());
        lenient().when(scopes.resolveDashboard(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(invocation -> new DashboardFilter(
                        scopes.resolve(invocation.getArgument(0), invocation.getArgument(1), invocation.getArgument(2)),
                        invocation.getArgument(3), invocation.getArgument(4), invocation.getArgument(5), invocation.getArgument(6),
                        invocation.getArgument(7), invocation.getArgument(8), invocation.getArgument(9)));
        lenient().when(repo.proposalsByStatus(any())).thenReturn(Map.of("SUBMITTED", 2L, "UNDER_SCRUTINY", 1L, "RECOMMENDED", 1L, "APPROVED", 3L, "REJECTED", 1L));
        lenient().when(repo.projectsByStatus(any())).thenReturn(Map.of("ACTIVE", 3L));
        lenient().when(repo.projectsAreaHa(any())).thenReturn(new BigDecimal("120.5"));
        lenient().when(repo.landTotals(any())).thenReturn(new LandTotals(10, new BigDecimal("30.5"), 4));
        lenient().when(repo.casesByStatus(any())).thenReturn(Map.of("INITIATED", 2L, "CLOSED", 3L, "CANCELLED", 1L));
        lenient().when(repo.acquisitionParcels(any())).thenReturn(new AcqParcelTotals(7, new BigDecimal("12.25")));
        lenient().when(repo.estimatesByStatus(any())).thenReturn(List.of(new StatusAmount("APPROVED", 2, new BigDecimal("3200002.00"))));
        lenient().when(repo.paymentsByStatus(any())).thenReturn(List.of(new StatusAmount("CONFIRMED", 2, new BigDecimal("3200002.00"))));
        lenient().when(repo.paymentsByChannel(any())).thenReturn(Map.of(
                "PFMS_SIMULATED", List.of(new StatusAmount("CONFIRMED", 1, new BigDecimal("100"))),
                "DBT_SIMULATED", List.of(), "OTHER_SIMULATED", List.of(), "UNCLASSIFIED", List.of()));
        lenient().when(repo.rrCasesByStatus(any())).thenReturn(Map.of("COMPLETED", 1L));
        lenient().when(repo.gisConflicts(any())).thenReturn(0L);
        lenient().when(repo.pendingTasks(any())).thenReturn(0L);
        lenient().when(repo.escalationsByLevel(any())).thenReturn(Map.of());
    }

    @Test
    void derivedFiguresAreComputedFromTheCounts() {
        Dashboard d = service.dashboard(null, null, actor("DASHBOARD_READ"));

        assertThat(d.proposals().total()).isEqualTo(8);
        assertThat(d.proposals().inReview()).isEqualTo(3);
        assertThat(d.proposals().awaitingDecision()).isEqualTo(1);
        assertThat(d.proposals().approved()).isEqualTo(3);
        assertThat(d.proposals().rejected()).isEqualTo(1);
        assertThat(d.projects().total()).isEqualTo(3);
        assertThat(d.acquisition().totalCases()).isEqualTo(6);
        assertThat(d.acquisition().openCases()).isEqualTo(2);
        assertThat(d.land().boundaryCoveragePercent()).isEqualByComparingTo("40.0");
    }

    @Test
    void moneyAppearsOnlyWithThePermissionsThatAllowIt() {
        assertThat(service.dashboard(null, null, actor("DASHBOARD_READ")).finance()).isNull();

        Dashboard valuationOnly = service.dashboard(null, null, actor("DASHBOARD_READ", "VALUATION_READ"));
        assertThat(valuationOnly.finance()).isNotNull();
        assertThat(valuationOnly.finance().estimates()).hasSize(1);
        assertThat(valuationOnly.finance().payments()).isNull();
        assertThat(valuationOnly.finance().rrCasesByStatus()).isNull();
        assertThat(valuationOnly.finance().paymentMode()).isNull();

        Dashboard all = service.dashboard(null, null, actor("DASHBOARD_READ", "VALUATION_READ", "PAYMENT_READ", "RR_READ"));
        assertThat(all.finance().payments()).hasSize(1);
        assertThat(all.finance().rrCasesByStatus()).containsEntry("COMPLETED", 1L);
        assertThat(all.finance().paymentMode()).isEqualTo("SIMULATED");
        assertThat(all.notes()).anyMatch(n -> n.contains("SIMULATED"));
    }

    @Test
    void theLevelFollowsTheFilters() {
        UUID id = UUID.randomUUID();
        assertThat(service.dashboard(null, null, actor("DASHBOARD_READ")).level()).isEqualTo("NATIONAL");
        assertThat(service.dashboard(id, null, actor("DASHBOARD_READ")).level()).isEqualTo("STATE");
        assertThat(service.dashboard(null, id, actor("DASHBOARD_READ")).level()).isEqualTo("DISTRICT");

        lenient().when(scopes.resolve(any(), any(), any())).thenReturn(new DistrictScope(false, Set.of(id)));
        assertThat(service.dashboard(null, null, actor("DASHBOARD_READ")).level()).isEqualTo("SCOPED");
        verify(scopes, org.mockito.Mockito.atLeastOnce()).resolve(any(), any(), any());
    }

    @Test
    void anEmptyDatabaseGivesZeros_notAnError() {
        lenient().when(repo.proposalsByStatus(any())).thenReturn(Map.of());
        lenient().when(repo.landTotals(any())).thenReturn(new LandTotals(0, BigDecimal.ZERO, 0));
        lenient().when(repo.casesByStatus(any())).thenReturn(Map.of());

        Dashboard d = service.dashboard(null, null, actor("DASHBOARD_READ"));

        assertThat(d.proposals().total()).isZero();
        assertThat(d.acquisition().openCases()).isZero();
        assertThat(d.land().boundaryCoveragePercent()).isEqualByComparingTo("0");
    }
}