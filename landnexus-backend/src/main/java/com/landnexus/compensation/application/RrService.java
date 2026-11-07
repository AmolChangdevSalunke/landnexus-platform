package com.landnexus.compensation.application;

import com.landnexus.acquisition.application.AcquisitionLookupService;
import com.landnexus.acquisition.application.AcquisitionLookupService.CaseRef;
import com.landnexus.compensation.api.dto.PaymentRrDtos.BenefitTypeRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.BenefitTypeResponse;
import com.landnexus.compensation.api.dto.PaymentRrDtos.DeliverRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.EntitlementRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.EntitlementResponse;
import com.landnexus.compensation.api.dto.PaymentRrDtos.RrCaseRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.RrCaseResponse;
import com.landnexus.compensation.domain.CompTypes.EntitlementStatus;
import com.landnexus.compensation.domain.CompTypes.RrBenefitKind;
import com.landnexus.compensation.domain.CompTypes.RrCaseStatus;
import com.landnexus.compensation.domain.RrBenefitType;
import com.landnexus.compensation.domain.RrCase;
import com.landnexus.compensation.domain.RrEntitlement;
import com.landnexus.compensation.infrastructure.RrBenefitTypeRepository;
import com.landnexus.compensation.infrastructure.RrCaseRepository;
import com.landnexus.compensation.infrastructure.RrEntitlementRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * R&R (rehabilitation and resettlement) tracking. A family is a landowner id from the case's ownership snapshot.
 * Eligibility uses only neutral facts (home lost, livelihood lost); no caste, religion or other sensitive data is held.
 */
@Service
@Transactional(readOnly = true)
public class RrService {

    private static final String ENTITY = "RrCase";
    private static final String READ = "RR_READ";

    private final RrBenefitTypeRepository benefitTypes;
    private final RrCaseRepository rrCases;
    private final RrEntitlementRepository entitlements;
    private final AcquisitionLookupService acquisition;
    private final CompensationAccess access;
    private final AuditService audit;
    private final Clock clock;

    public RrService(RrBenefitTypeRepository benefitTypes, RrCaseRepository rrCases, RrEntitlementRepository entitlements,
                     AcquisitionLookupService acquisition, CompensationAccess access, AuditService audit, Clock clock) {
        this.benefitTypes = benefitTypes;
        this.rrCases = rrCases;
        this.entitlements = entitlements;
        this.acquisition = acquisition;
        this.access = access;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ catalogue

    public List<BenefitTypeResponse> listBenefitTypes() {
        return benefitTypes.findAllByOrderByCodeAsc().stream().map(RrService::toResponse).toList();
    }

    @Transactional
    public BenefitTypeResponse createBenefitType(BenefitTypeRequest r, CurrentActor actor) {
        if (benefitTypes.existsByCode(r.code())) {
            throw new DuplicateResourceException("A benefit type with code " + r.code() + " already exists");
        }
        if ((r.kind() == RrBenefitKind.ONE_TIME_CASH || r.kind() == RrBenefitKind.MONTHLY_ALLOWANCE) && r.defaultAmount() == null) {
            throw new InvalidRequestException("A cash benefit needs a default amount");
        }
        if (r.kind() == RrBenefitKind.MONTHLY_ALLOWANCE && r.defaultMonths() == null) {
            throw new InvalidRequestException("A monthly allowance needs a default number of months");
        }
        RrBenefitType saved = benefitTypes.saveAndFlush(new RrBenefitType(r.code(), r.name().trim(), r.kind(),
//                r.defaultAmount(), r.defaultMonths(), r.requiresDisplaced(), r.requiresLivelihoodLost()));
                r.defaultAmount(), r.defaultMonths(), Boolean.TRUE.equals(r.requiresDisplaced()),
                Boolean.TRUE.equals(r.requiresLivelihoodLost())));
        audit.record("CREATE_BENEFIT_TYPE", "RrBenefitType", saved.getId(), "code=" + saved.getCode() + ", kind=" + saved.getKind());
        return toResponse(saved);
    }

    // ------------------------------------------------------------------ cases

    public List<RrCaseResponse> listForCase(UUID caseId, CurrentActor actor) {
        requireCase(caseId, actor);
        return rrCases.findByCaseIdOrderByCreatedAtAsc(caseId).stream().map(rc -> toResponse(rc, actor)).toList();
    }

    public RrCaseResponse get(UUID id, CurrentActor actor) {
        return toResponse(load(id, actor), actor);
    }

    @Transactional
    public RrCaseResponse identify(UUID caseId, RrCaseRequest r, CurrentActor actor) {
        CaseRef c = requireCase(caseId, actor);
        if (!ValuationService.ASSET_CASE_STATUSES.contains(c.status())) {
            throw new InvalidTransitionException("R&R cases cannot be identified while the case is " + c.status());
        }
        if (!acquisition.caseLandownerIds(caseId).contains(r.landownerId())) {
            throw new InvalidRequestException("The landowner is not an owner of any affected parcel of this case");
        }
        if (rrCases.existsByCaseIdAndLandownerId(caseId, r.landownerId())) {
            throw new DuplicateResourceException("An R&R case already exists for this family");
        }
        RrCase saved = rrCases.saveAndFlush(new RrCase(caseId, r.landownerId(), r.displaced(), r.livelihoodLost(),
                blankToNull(r.notes()), actor.userId()));
        audit.record("IDENTIFY_RR", ENTITY, saved.getId(), "caseId=" + caseId + ", displaced=" + r.displaced()
                + ", livelihoodLost=" + r.livelihoodLost());
        return toResponse(saved, actor);
    }

    @Transactional
    public RrCaseResponse addEntitlement(UUID rrCaseId, EntitlementRequest r, CurrentActor actor) {
        RrCase rc = load(rrCaseId, actor);
        if (rc.getStatus() != RrCaseStatus.IDENTIFIED && rc.getStatus() != RrCaseStatus.ASSESSED) {
            throw new InvalidTransitionException("Entitlements can be added only before the assessment is approved");
        }
        RrBenefitType t = benefitTypes.findById(r.benefitTypeId()).filter(RrBenefitType::isActive)
                .orElseThrow(() -> new InvalidRequestException("Unknown or inactive benefit type: " + r.benefitTypeId()));
        if (t.isRequiresDisplaced() && !rc.isDisplaced()) {
            throw new InvalidRequestException("This benefit is only for families that lost their home");
        }
        if (t.isRequiresLivelihoodLost() && !rc.isLivelihoodLost()) {
            throw new InvalidRequestException("This benefit is only for families that lost their livelihood");
        }
        if (entitlements.existsByRrCaseIdAndBenefitTypeId(rrCaseId, t.getId())) {
            throw new DuplicateResourceException("The family already has this benefit");
        }
        BigDecimal amount = r.amount() != null ? r.amount() : t.getDefaultAmount();
        Integer months = r.months() != null ? r.months() : t.getDefaultMonths();
        if ((t.getKind() == RrBenefitKind.ONE_TIME_CASH || t.getKind() == RrBenefitKind.MONTHLY_ALLOWANCE) && amount == null) {
            throw new InvalidRequestException("An amount is required for this cash benefit");
        }
        if (t.getKind() == RrBenefitKind.MONTHLY_ALLOWANCE && months == null) {
            throw new InvalidRequestException("The number of months is required for a monthly allowance");
        }
        entitlements.saveAndFlush(new RrEntitlement(rrCaseId, t.getId(), t.getCode(), t.getName(), t.getKind(), amount, months));
        rc.markAssessed();
        RrCase saved = rrCases.saveAndFlush(rc);
        audit.record("ADD_ENTITLEMENT", ENTITY, rrCaseId, "benefit=" + t.getCode() + ", amount=" + amount);
        return toResponse(saved, actor);
    }

    @Transactional
    public RrCaseResponse approve(UUID rrCaseId, CurrentActor actor) {
        RrCase rc = load(rrCaseId, actor);
        if (rc.getStatus() != RrCaseStatus.ASSESSED) {
            throw new InvalidTransitionException("Only an assessed R&R case can be approved");
        }
        if (actor.userId().equals(rc.getCreatedByUserId())) {
            throw new AccessDeniedException("The person who identified an R&R case cannot approve it");
        }
        rc.approve(actor.userId(), clock.instant());
        RrCase saved = rrCases.saveAndFlush(rc);
        audit.record("APPROVE_RR", ENTITY, rrCaseId, "entitlements=" + entitlements.findByRrCaseIdOrderByCreatedAtAsc(rrCaseId).size());
        return toResponse(saved, actor);
    }

    @Transactional
    public RrCaseResponse deliver(UUID rrCaseId, UUID entitlementId, DeliverRequest r, CurrentActor actor) {
        RrCase rc = load(rrCaseId, actor);
        if (rc.getStatus() != RrCaseStatus.APPROVED) {
            throw new InvalidTransitionException("Benefits can be delivered only after the assessment is approved");
        }
        if (r.deliveredOn().isAfter(LocalDate.now(clock))) {
            throw new InvalidRequestException("The delivery date cannot be in the future");
        }
        RrEntitlement e = entitlements.findById(entitlementId).filter(x -> x.getRrCaseId().equals(rrCaseId))
                .orElseThrow(() -> new ResourceNotFoundException("Entitlement not found: " + entitlementId));
        if (e.getStatus() != EntitlementStatus.PLANNED) {
            throw new InvalidTransitionException("This benefit has already been delivered");
        }
        e.deliver(r.deliveredOn(), blankToNull(r.remarks()));
        entitlements.saveAndFlush(e);
        audit.record("DELIVER_BENEFIT", ENTITY, rrCaseId, "benefit=" + e.getBenefitCode() + ", date=" + r.deliveredOn());
        return toResponse(rc, actor);
    }

    @Transactional
    public RrCaseResponse complete(UUID rrCaseId, CurrentActor actor) {
        RrCase rc = load(rrCaseId, actor);
        if (rc.getStatus() != RrCaseStatus.APPROVED) {
            throw new InvalidTransitionException("Only an approved R&R case can be completed");
        }
        long open = entitlements.countByRrCaseIdAndStatus(rrCaseId, EntitlementStatus.PLANNED);
        if (open > 0) {
            throw new InvalidRequestException(open + " benefit(s) have not been delivered yet");
        }
        rc.complete();
        RrCase saved = rrCases.saveAndFlush(rc);
        audit.record("COMPLETE_RR", ENTITY, rrCaseId, "completed");
        return toResponse(saved, actor);
    }

    // ------------------------------------------------------------------ helpers

    private CaseRef requireCase(UUID caseId, CurrentActor actor) {
        return acquisition.findCase(caseId).filter(c -> access.canView(actor, c.districtId(), READ))
                .orElseThrow(() -> new ResourceNotFoundException("Case not found: " + caseId));
    }

    private RrCase load(UUID id, CurrentActor actor) {
        RrCase rc = rrCases.findById(id).orElseThrow(() -> new ResourceNotFoundException("R&R case not found: " + id));
        requireCase(rc.getCaseId(), actor);
        return rc;
    }

    private RrCaseResponse toResponse(RrCase rc, CurrentActor actor) {
        List<EntitlementResponse> rows = entitlements.findByRrCaseIdOrderByCreatedAtAsc(rc.getId()).stream()
                .map(e -> new EntitlementResponse(e.getId(), e.getBenefitCode(), e.getBenefitName(), e.getKind(), e.getAmount(),
                        e.getMonths(), e.getStatus(), e.getDeliveredOn(), e.getDeliveryRemarks())).toList();
        List<String> actions = new ArrayList<>();
        boolean manager = actor.hasAuthority("RR_MANAGE");
        if (manager && (rc.getStatus() == RrCaseStatus.IDENTIFIED || rc.getStatus() == RrCaseStatus.ASSESSED)) {
            actions.add("ADD_ENTITLEMENT");
        }
        if (rc.getStatus() == RrCaseStatus.ASSESSED && actor.hasAuthority("RR_APPROVE")
                && !actor.userId().equals(rc.getCreatedByUserId())) {
            actions.add("APPROVE");
        }
        if (manager && rc.getStatus() == RrCaseStatus.APPROVED) {
            actions.add("DELIVER");
            actions.add("COMPLETE");
        }
        return new RrCaseResponse(rc.getId(), rc.getCaseId(), rc.getLandownerId(), rc.isDisplaced(), rc.isLivelihoodLost(),
                rc.getStatus(), rc.getNotes(), rc.getCreatedByUserId(), rc.getApprovedByUserId(), rc.getDecidedAt(), rows, actions);
    }

    private static BenefitTypeResponse toResponse(RrBenefitType t) {
        return new BenefitTypeResponse(t.getId(), t.getCode(), t.getName(), t.getKind(), t.getDefaultAmount(),
                t.getDefaultMonths(), t.isRequiresDisplaced(), t.isRequiresLivelihoodLost(), t.isActive());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}