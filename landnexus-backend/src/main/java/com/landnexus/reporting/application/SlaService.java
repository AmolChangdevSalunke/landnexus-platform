package com.landnexus.reporting.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.reporting.api.dto.SlaDtos.EscalationDto;
import com.landnexus.reporting.api.dto.SlaDtos.EscalationPage;
import com.landnexus.reporting.api.dto.SlaDtos.ScanResult;
import com.landnexus.reporting.api.dto.SlaDtos.SlaItem;
import com.landnexus.reporting.api.dto.SlaDtos.SlaOverview;
import com.landnexus.reporting.api.dto.SlaDtos.SlaRuleDto;
import com.landnexus.reporting.api.dto.SlaDtos.SlaRuleRequest;
import com.landnexus.reporting.api.dto.SlaDtos.SlaTypeSummary;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.SlaRepository;
import com.landnexus.reporting.infrastructure.SlaRepository.CountRow;
import com.landnexus.reporting.infrastructure.SlaRepository.Escalated;
import com.landnexus.reporting.infrastructure.SlaRepository.EscalationRows;
import com.landnexus.reporting.infrastructure.SlaRepository.ItemRow;
import com.landnexus.reporting.infrastructure.SlaRepository.RuleRow;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SLA status, rules and escalation. Escalation only sends in-app notifications (to the responsible role and, on a breach,
 * to the escalation role of the district); it never changes the state of any proposal, case or payment.
 */
@Service
@Transactional(readOnly = true)
public class SlaService {

    static final int MAX_ITEMS = 200;
    static final Set<String> ROLES = Set.of("SCRUTINY_OFFICER", "FIELD_OFFICER", "COMPETENT_AUTHORITY", "FINANCE_OFFICER",
            "DISTRICT_ADMIN", "DIVISION_ADMIN", "STATE_ADMIN");

    private final SlaRepository repo;
    private final ReportingScope scopes;
    private final AdministrationLookupService admin;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public SlaService(SlaRepository repo, ReportingScope scopes, AdministrationLookupService admin,
                      NotificationService notifications, AuditService audit, Clock clock) {
        this.repo = repo;
        this.scopes = scopes;
        this.admin = admin;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ status

    public SlaOverview overview(UUID stateId, UUID districtId, CurrentActor actor) {
        DistrictScope scope = scopes.resolve(actor, stateId, districtId);
        Map<String, long[]> counts = new HashMap<>();   // [on time, warning, breach]
        for (CountRow c : repo.counts(scope)) {
            long[] a = counts.computeIfAbsent(c.itemType(), k -> new long[3]);
            a[switch (c.level()) { case "BREACH" -> 2; case "WARNING" -> 1; default -> 0; }] += c.count();
        }
        List<SlaTypeSummary> byType = repo.rules().stream().filter(RuleRow::active).map(r -> {
            long[] a = counts.getOrDefault(r.itemType(), new long[3]);
            return new SlaTypeSummary(r.itemType(), r.title(), a[0], a[1], a[2], r.warnAfterHours(), r.breachAfterHours(), r.responsibleRole());
        }).toList();
        long onTime = byType.stream().mapToLong(SlaTypeSummary::onTime).sum();
        long warning = byType.stream().mapToLong(SlaTypeSummary::warning).sum();
        long breach = byType.stream().mapToLong(SlaTypeSummary::breach).sum();
        List<SlaItem> items = repo.overdueItems(scope, MAX_ITEMS).stream().map(SlaService::toDto).toList();
        return new SlaOverview(clock.instant(), onTime, warning, breach, byType, items, warning + breach > items.size(),
                List.of("Counts include only records inside your geographic scope.",
                        "Waiting time is counted from when the item started waiting (for an estimate: from when it was calculated).",
                        "Escalation only sends in-app notifications: no status is ever changed automatically."));
    }

    public List<SlaRuleDto> rules() {
        return repo.rules().stream().map(SlaService::toDto).toList();
    }

    public EscalationPage escalations(UUID stateId, UUID districtId, int page, int size, CurrentActor actor) {
        if (page < 0 || size < 1 || size > 100) {
            throw new InvalidRequestException("page must be 0 or more and size between 1 and 100");
        }
        DistrictScope scope = scopes.resolve(actor, stateId, districtId);
        EscalationRows result = repo.escalations(scope, size, page * size);
        return new EscalationPage(result.rows().stream().map(e -> new EscalationDto(e.id(), e.itemType(), e.entityId(), e.reference(),
                e.level(), e.thresholdHours(), e.since(), e.responsibleRole(), e.escalateRole(), e.triggeredBy(), e.createdAt())).toList(),
                page, size, result.total());
    }

    // ------------------------------------------------------------------ rules (administrators)

    @Transactional
    public SlaRuleDto updateRule(String itemType, SlaRuleRequest r, CurrentActor actor) {
        RuleRow current = repo.rule(itemType).orElseThrow(() -> new ResourceNotFoundException("SLA rule not found: " + itemType));
        if (r.breachAfterHours() <= r.warnAfterHours()) {
            throw new InvalidRequestException("The breach limit must be longer than the warning limit");
        }
        String responsible = r.responsibleRole().trim();
        String escalate = r.escalateRole() == null || r.escalateRole().isBlank() ? null : r.escalateRole().trim();
        if (!ROLES.contains(responsible) || (escalate != null && !ROLES.contains(escalate))) {
            throw new InvalidRequestException("The roles must be among " + new java.util.TreeSet<>(ROLES));
        }
        if (repo.updateRule(itemType, r.warnAfterHours(), r.breachAfterHours(), responsible, escalate, r.active(), r.rowVersion()) == 0) {
            throw new InvalidTransitionException("The rule was changed by someone else: reload it and try again");
        }
        audit.record("UPDATE_SLA_RULE", "SlaRule", current.id(), "type=" + itemType + ", warn " + current.warnAfterHours() + "h -> "
                + r.warnAfterHours() + "h, breach " + current.breachAfterHours() + "h -> " + r.breachAfterHours() + "h, responsible="
                + responsible + ", escalate=" + escalate + ", active=" + r.active());
        return toDto(repo.rule(itemType).orElseThrow());
    }

    // ------------------------------------------------------------------ scan and escalate

    /** A scan started by an administrator: audited. districtId limits it to one district. */
    @Transactional
    public ScanResult scanBy(UUID districtId, CurrentActor actor) {
        ScanResult result = scan(actor.username(), districtId);
        audit.record("SLA_SCAN", "Sla", null, "districtId=" + districtId + ", warnings=" + result.warningsRaised()
                + ", breaches=" + result.breachesRaised() + ", notifications=" + result.notificationsSent());
        return result;
    }

    /** The scheduled scan has no logged-in person: the sla_escalations table is its own log. */
    @Transactional
    public ScanResult scanAsScheduler() {
        return scan("SCHEDULER", null);
    }

    private ScanResult scan(String triggeredBy, UUID districtId) {
        List<Escalated> raised = repo.escalate(triggeredBy, districtId);
        Map<String, RuleRow> rules = repo.rules().stream().collect(Collectors.toMap(RuleRow::itemType, Function.identity()));
        Set<String> breached = raised.stream().filter(e -> "BREACH".equals(e.level())).map(SlaService::key).collect(Collectors.toSet());
        int warnings = 0;
        int breaches = 0;
        int sent = 0;
        for (Escalated e : raised) {
            boolean breach = "BREACH".equals(e.level());
            if (breach) {
                breaches++;
            } else {
                warnings++;
                if (breached.contains(key(e))) {
                    continue;   // the same item also breached in this run: one notification (the breach) is enough
                }
            }
            String what = rules.containsKey(e.itemType()) ? rules.get(e.itemType()).title() : e.itemType();
            String title = (breach ? "SLA breach: " : "SLA warning: ") + what;
            String message = e.reference() + " has been waiting since " + e.since() + " (" + (breach ? "breach" : "warning")
                    + " limit " + e.thresholdHours() + " hours).";
            for (UUID userId : recipients(e)) {
                notifications.notify(userId, "SLA", title, message, e.itemType(), e.entityId());
                sent++;
            }
        }
        return new ScanResult(clock.instant(), warnings, breaches, sent);
    }

    private Set<UUID> recipients(Escalated e) {
        Set<UUID> ids = new LinkedHashSet<>();
        admin.findUsersByRoleWithDistrictAccess(e.responsibleRole(), e.districtId()).forEach(u -> ids.add(u.id()));
        if ("BREACH".equals(e.level()) && e.escalateRole() != null) {
            admin.findUsersByRoleWithDistrictAccess(e.escalateRole(), e.districtId()).forEach(u -> ids.add(u.id()));
        }
        return ids;
    }

    private static String key(Escalated e) {
        return e.itemType() + "|" + e.entityId() + "|" + e.since();
    }

    private static SlaItem toDto(ItemRow i) {
        return new SlaItem(i.itemType(), i.title(), i.entityId(), i.reference(), i.districtId(), i.since(), i.ageHours(), i.level(),
                i.responsibleRole());
    }

    private static SlaRuleDto toDto(RuleRow r) {
        return new SlaRuleDto(r.id(), r.itemType(), r.title(), r.warnAfterHours(), r.breachAfterHours(), r.responsibleRole(),
                r.escalateRole(), r.active(), r.note(), r.rowVersion());
    }
}