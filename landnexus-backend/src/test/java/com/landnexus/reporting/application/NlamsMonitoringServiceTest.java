package com.landnexus.reporting.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.landnexus.reporting.api.dto.NlamsDtos.NlamsDashboard;
import com.landnexus.reporting.api.dto.NlamsDtos.NlamsProject;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.NlamsRepository;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NlamsMonitoringServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-12T05:00:00Z");

    @Mock private NlamsRepository repo;
    @Mock private ReportingScope scope;

    private NlamsMonitoringService service;

    private final CurrentActor actor = new CurrentActor(UUID.randomUUID(), "officer", Set.of("DISTRICT_ADMIN"));

    @BeforeEach
    void setUp() {
        service = new NlamsMonitoringService(repo, scope, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void aProjectWithoutAnAcquisitionCaseIsAtZero() {
        NlamsProject project = project(0, 0, 0, 0, 0);

        assertThat(NlamsMonitoringService.progressPercent(project)).isZero();
        assertThat(NlamsMonitoringService.currentStage(project)).isEqualTo("Project approved");
    }

    @Test
    void eachMilestoneAddsTwentyPercent() {
        assertThat(NlamsMonitoringService.progressPercent(project(1, 0, 0, 0, 0))).isEqualTo(20);
        assertThat(NlamsMonitoringService.currentStage(project(1, 0, 0, 0, 0))).isEqualTo("Case initiated");
        assertThat(NlamsMonitoringService.progressPercent(project(1, 5, 0, 0, 0))).isEqualTo(40);
        assertThat(NlamsMonitoringService.currentStage(project(1, 5, 0, 0, 0))).isEqualTo("Parcels identified");
        assertThat(NlamsMonitoringService.progressPercent(project(1, 5, 5, 0, 0))).isEqualTo(60);
        assertThat(NlamsMonitoringService.currentStage(project(1, 5, 5, 0, 0))).isEqualTo("Notification complete");
        assertThat(NlamsMonitoringService.progressPercent(project(1, 5, 5, 5, 0))).isEqualTo(80);
        assertThat(NlamsMonitoringService.currentStage(project(1, 5, 5, 5, 0))).isEqualTo("Award declared");
        assertThat(NlamsMonitoringService.progressPercent(project(1, 5, 5, 5, 5))).isEqualTo(100);
        assertThat(NlamsMonitoringService.currentStage(project(1, 5, 5, 5, 5))).isEqualTo("Possession complete");
    }

    @Test
    void partialNotificationDoesNotCountAsComplete() {
        assertThat(NlamsMonitoringService.progressPercent(project(1, 5, 3, 0, 0))).isEqualTo(40);
    }

    @Test
    void dashboardAggregatesAndKeepsPaymentsSimulated() {
        when(scope.resolve(actor, null, null)).thenReturn(DistrictScope.all());
        when(repo.findProjects(any(), any())).thenReturn(List.of(project(1, 5, 5, 5, 5), project(0, 0, 0, 0, 0)));

        NlamsDashboard dashboard = service.dashboard(null, null, actor);

        assertThat(dashboard.generatedAt()).isEqualTo(NOW);
        assertThat(dashboard.paymentMode()).isEqualTo("SIMULATED");
        assertThat(dashboard.totals().projects()).isEqualTo(2);
        assertThat(dashboard.totals().projectsInAcquisition()).isEqualTo(1);
        assertThat(dashboard.totals().parcelsIdentified()).isEqualTo(5);
        assertThat(dashboard.projectsByStage()).containsEntry("Possession complete", 1L)
                .containsEntry("Project approved", 1L);
        assertThat(dashboard.projects()).hasSize(2);
    }

    private static NlamsProject project(long cases, long parcels, long notified, long awarded, long possessed) {
        return new NlamsProject(
                UUID.randomUUID(), "PRJ-2026-000001", "Test project", "STATE_HIGHWAY", "ACTIVE",
                UUID.randomUUID(), "District", new BigDecimal("12.50"), new BigDecimal("4.20"),
                cases, cases, 0, 0, 0, 0,
                parcels, new BigDecimal("10.00"), notified, new BigDecimal("10.00"),
                0, awarded, new BigDecimal("10.00"),
                possessed, new BigDecimal("10.00"), 0, 0,
                0, 0, 0,
                BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("100.00"), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO,
                1, 0, 0,
                0, 0, 0, 0,
                0, "");
    }
}
