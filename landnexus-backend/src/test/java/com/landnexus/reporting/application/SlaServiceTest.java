package com.landnexus.reporting.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.reporting.api.dto.SlaDtos.ScanResult;
import com.landnexus.reporting.api.dto.SlaDtos.SlaOverview;
import com.landnexus.reporting.api.dto.SlaDtos.SlaRuleRequest;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.SlaRepository;
import com.landnexus.reporting.infrastructure.SlaRepository.CountRow;
import com.landnexus.reporting.infrastructure.SlaRepository.Escalated;
import com.landnexus.reporting.infrastructure.SlaRepository.RuleRow;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SlaServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-08T10:00:00Z");

    @Mock private SlaRepository repo;
    @Mock private ReportingScope scopes;
    @Mock private AdministrationLookupService admin;
    @Mock private NotificationService notifications;
    @Mock private AuditService audit;

    private SlaService service;
    private final UUID district = UUID.randomUUID();
    private final UUID entity = UUID.randomUUID();
    private final UUID officer = UUID.randomUUID();
    private final UUID authority = UUID.randomUUID();
    private final Instant since = NOW.minusSeconds(3600L * 300);
    private final CurrentActor adminActor = new CurrentActor(UUID.randomUUID(), "admin", Set.of("SUPER_ADMIN"), Set.of("SETTINGS_MANAGE", "SLA_READ"));
    private final RuleRow rule = new RuleRow(UUID.randomUUID(), "PROPOSAL_AWAITING_SCRUTINY", "Proposal waiting for scrutiny", 120, 240,
            "SCRUTINY_OFFICER", "COMPETENT_AUTHORITY", true, "DEMO", 3);

    @BeforeEach
    void setUp() {
        service = new SlaService(repo, scopes, admin, notifications, audit, Clock.fixed(NOW, ZoneOffset.UTC));
        lenient().when(repo.rules()).thenReturn(List.of(rule));
        lenient().when(admin.findUsersByRoleWithDistrictAccess("SCRUTINY_OFFICER", district)).thenReturn(List.of(new UserRef(officer, "officer")));
        lenient().when(admin.findUsersByRoleWithDistrictAccess("COMPETENT_AUTHORITY", district)).thenReturn(List.of(new UserRef(authority, "authority")));
    }

    private Escalated escalated(String level, String escalateRole) {
        return new Escalated(UUID.randomUUID(), "PROPOSAL_AWAITING_SCRUTINY", entity, since, level, "PRP-1", district, "SCRUTINY_OFFICER",
                escalateRole, "BREACH".equals(level) ? 240 : 120);
    }

    @Test
    void aWarning_notifiesTheResponsibleRoleOnly() {
        when(repo.escalate("admin", district)).thenReturn(List.of(escalated("WARNING", null)));

        ScanResult r = service.scanBy(district, adminActor);

        assertThat(r.warningsRaised()).isEqualTo(1);
        assertThat(r.breachesRaised()).isZero();
        assertThat(r.notificationsSent()).isEqualTo(1);
        verify(notifications).notify(eq(officer), eq("SLA"), anyString(), anyString(), eq("PROPOSAL_AWAITING_SCRUTINY"), eq(entity));
        verify(audit).record(eq("SLA_SCAN"), eq("Sla"), eq(null), anyString());
    }

    @Test
    void aBreach_alsoNotifiesTheEscalationRole_andTheSameRunWarningIsNotSentTwice() {
        when(repo.escalate("admin", district)).thenReturn(List.of(escalated("WARNING", null), escalated("BREACH", "COMPETENT_AUTHORITY")));

        ScanResult r = service.scanBy(district, adminActor);

        assertThat(r.warningsRaised()).isEqualTo(1);
        assertThat(r.breachesRaised()).isEqualTo(1);
        assertThat(r.notificationsSent()).isEqualTo(2);   // breach: officer + authority; the warning of the same item is skipped
        verify(notifications).notify(eq(officer), anyString(), anyString(), anyString(), anyString(), eq(entity));
        verify(notifications).notify(eq(authority), anyString(), anyString(), anyString(), anyString(), eq(entity));
    }

    @Test
    void aPersonWhoHoldsBothRoles_isNotifiedOnlyOncePerAlert() {
        when(admin.findUsersByRoleWithDistrictAccess("COMPETENT_AUTHORITY", district)).thenReturn(List.of(new UserRef(officer, "officer")));
        when(repo.escalate("admin", district)).thenReturn(List.of(escalated("BREACH", "COMPETENT_AUTHORITY")));

        assertThat(service.scanBy(district, adminActor).notificationsSent()).isEqualTo(1);
        verify(notifications, times(1)).notify(any(), anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void nothingNew_sendsNothing_andTheSchedulerDoesNotAudit() {
        when(repo.escalate("SCHEDULER", null)).thenReturn(List.of());

        ScanResult r = service.scanAsScheduler();

        assertThat(r.notificationsSent()).isZero();
        verify(notifications, never()).notify(any(), anyString(), anyString(), anyString(), anyString(), any());
        verify(audit, never()).record(anyString(), anyString(), any(), anyString());
    }

    @Test
    void updateRule_refusesBadLimitsAndUnknownRoles_andUnknownRules() {
        when(repo.rule("PROPOSAL_AWAITING_SCRUTINY")).thenReturn(Optional.of(rule));
        when(repo.rule("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateRule("NOPE", new SlaRuleRequest(1, 2, "SCRUTINY_OFFICER", null, true, 0L), adminActor))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.updateRule("PROPOSAL_AWAITING_SCRUTINY", new SlaRuleRequest(50, 50, "SCRUTINY_OFFICER", null, true, 3L), adminActor))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("longer");
        assertThatThrownBy(() -> service.updateRule("PROPOSAL_AWAITING_SCRUTINY", new SlaRuleRequest(10, 20, "CITIZEN", null, true, 3L), adminActor))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> service.updateRule("PROPOSAL_AWAITING_SCRUTINY", new SlaRuleRequest(10, 20, "SCRUTINY_OFFICER", "NOBODY", true, 3L), adminActor))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void updateRule_withAStaleVersion_isAConflict_andAGoodUpdateIsAudited() {
        when(repo.rule("PROPOSAL_AWAITING_SCRUTINY")).thenReturn(Optional.of(rule));
        when(repo.updateRule("PROPOSAL_AWAITING_SCRUTINY", 10, 20, "SCRUTINY_OFFICER", "COMPETENT_AUTHORITY", true, 2L)).thenReturn(0);
        when(repo.updateRule("PROPOSAL_AWAITING_SCRUTINY", 10, 20, "SCRUTINY_OFFICER", "COMPETENT_AUTHORITY", true, 3L)).thenReturn(1);

        assertThatThrownBy(() -> service.updateRule("PROPOSAL_AWAITING_SCRUTINY",
                new SlaRuleRequest(10, 20, "SCRUTINY_OFFICER", "COMPETENT_AUTHORITY", true, 2L), adminActor))
                .isInstanceOf(InvalidTransitionException.class);
        service.updateRule("PROPOSAL_AWAITING_SCRUTINY", new SlaRuleRequest(10, 20, "SCRUTINY_OFFICER", "COMPETENT_AUTHORITY", true, 3L), adminActor);

        verify(audit).record(eq("UPDATE_SLA_RULE"), eq("SlaRule"), eq(rule.id()), anyString());
    }

    @Test
    void theOverviewListsEveryActiveRule_evenWithoutItems_andSumsTheLevels() {
        when(scopes.resolve(any(), any(), any())).thenReturn(DistrictScope.all());
        when(repo.counts(any())).thenReturn(List.of(new CountRow("PROPOSAL_AWAITING_SCRUTINY", "ON_TIME", 4),
                new CountRow("PROPOSAL_AWAITING_SCRUTINY", "WARNING", 2), new CountRow("PROPOSAL_AWAITING_SCRUTINY", "BREACH", 1)));
        when(repo.overdueItems(any(), eq(SlaService.MAX_ITEMS))).thenReturn(List.of());
        when(repo.rules()).thenReturn(List.of(rule, new RuleRow(UUID.randomUUID(), "PAYMENT_AWAITING_RELEASE", "Payment", 72, 168,
                "FINANCE_OFFICER", "DISTRICT_ADMIN", true, null, 0), new RuleRow(UUID.randomUUID(), "SURVEY_AWAITING_VERIFICATION", "Survey",
                72, 168, "SCRUTINY_OFFICER", null, false, null, 0)));

        SlaOverview o = service.overview(null, null, adminActor);

        assertThat(o.byType()).hasSize(2);   // the inactive rule is left out
        assertThat(o.onTime()).isEqualTo(4);
        assertThat(o.warning()).isEqualTo(2);
        assertThat(o.breach()).isEqualTo(1);
        assertThat(o.byType().get(1).breach()).isZero();
        assertThat(o.itemsTruncated()).isTrue();   // 3 overdue, 0 listed
        assertThat(o.notes()).anyMatch(n -> n.contains("never changed automatically") || n.contains("no status is ever changed"));
    }
}