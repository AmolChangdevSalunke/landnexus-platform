package com.landnexus.compensation.application;

import com.landnexus.acquisition.application.AcquisitionLookupService;
import com.landnexus.acquisition.application.AcquisitionLookupService.AwardLineRef;
import com.landnexus.acquisition.application.AcquisitionLookupService.CaseRef;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.compensation.api.dto.CompensationDtos.AssetRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.AssetResponse;
import com.landnexus.compensation.api.dto.CompensationDtos.CompensationSummary;
import com.landnexus.compensation.api.dto.CompensationDtos.LineResponse;
import com.landnexus.compensation.api.dto.CompensationDtos.SummaryRow;
import com.landnexus.compensation.api.dto.CompensationDtos.ValuationResponse;
import com.landnexus.compensation.application.RuleSetService.Selected;
import com.landnexus.compensation.domain.AssetRecord;
import com.landnexus.compensation.domain.CompTypes.ValuationStatus;
import com.landnexus.compensation.domain.MarketValueRate;
import com.landnexus.compensation.domain.Valuation;
import com.landnexus.compensation.domain.ValuationLine;
import com.landnexus.compensation.infrastructure.AssetRecordRepository;
import com.landnexus.compensation.infrastructure.ValuationLineRepository;
import com.landnexus.compensation.infrastructure.ValuationRepository;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.landrecords.application.LandRecordsLookupService.ParcelRef;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Assets, compensation estimates per awarded parcel, their approval, and the case summary. */
@Service
@Transactional(readOnly = true)
public class ValuationService {

    static final Set<String> VALUATION_CASE_STATUSES = Set.of("AWARD_DECLARED", "POSSESSION_TAKEN");
    static final Set<String> ASSET_CASE_STATUSES = Set.of("SURVEY_IN_PROGRESS", "VERIFICATION_COMPLETE",
            "NOTIFICATION_ISSUED", "READY_FOR_AWARD", "AWARD_DECLARED", "POSSESSION_TAKEN");
    private static final List<ValuationStatus> LIVE = List.of(ValuationStatus.DRAFT, ValuationStatus.SUBMITTED, ValuationStatus.APPROVED);
    private static final List<ValuationStatus> LOCKED = List.of(ValuationStatus.SUBMITTED, ValuationStatus.APPROVED);
    private static final BigDecimal LIMIT = new BigDecimal("9999999999999.99");
    private static final String ENTITY = "Valuation";
    private static final String CASE_ENTITY = "AcquisitionCase";

    private final ValuationRepository valuations;
    private final ValuationLineRepository lines;
    private final AssetRecordRepository assets;
    private final RateService rates;
    private final RuleSetService ruleSets;
    private final AcquisitionLookupService acquisition;
    private final LandRecordsLookupService land;
    private final AdministrationLookupService admin;
    private final CompensationAccess access;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public ValuationService(ValuationRepository valuations, ValuationLineRepository lines, AssetRecordRepository assets,
                            RateService rates, RuleSetService ruleSets, AcquisitionLookupService acquisition,
                            LandRecordsLookupService land, AdministrationLookupService admin, CompensationAccess access,
                            NotificationService notifications, AuditService audit, Clock clock) {
        this.valuations = valuations;
        this.lines = lines;
        this.assets = assets;
        this.rates = rates;
        this.ruleSets = ruleSets;
        this.acquisition = acquisition;
        this.land = land;
        this.admin = admin;
        this.access = access;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ assets

    public List<AssetResponse> listAssets(UUID caseId, UUID caseParcelId, CurrentActor actor) {
        requireCase(caseId, actor);
        requireCaseParcel(caseId, caseParcelId);
        return assets.findByCaseParcelIdOrderByCreatedAtAsc(caseParcelId).stream().map(ValuationService::toResponse).toList();
    }

    @Transactional
    public AssetResponse recordAsset(UUID caseId, UUID caseParcelId, AssetRequest r, CurrentActor actor) {
        CaseRef c = requireCase(caseId, actor);
        if (!ASSET_CASE_STATUSES.contains(c.status())) {
            throw new InvalidTransitionException("Assets cannot be recorded while the case is " + c.status());
        }
        requireCaseParcel(caseId, caseParcelId);
        requireNoLockedValuation(caseParcelId);
        BigDecimal value = r.quantity().multiply(r.unitValue()).setScale(2, RoundingMode.HALF_UP);
        if (value.compareTo(LIMIT) > 0) {
            throw new InvalidRequestException("The asset value is too large");
        }
        AssetRecord saved = assets.saveAndFlush(new AssetRecord(caseParcelId, r.category(), r.description().trim(),
                r.quantity(), r.unit().trim(), r.unitValue(), value, actor.userId()));
        audit.record("ADD_ASSET", CASE_ENTITY, caseId, "caseParcelId=" + caseParcelId + ", category=" + r.category()
                + ", value=" + value);
        return toResponse(saved);
    }

    @Transactional
    public AssetResponse voidAsset(UUID caseId, UUID assetId, String reason, CurrentActor actor) {
        requireCase(caseId, actor);
        AssetRecord a = assets.findById(assetId)
                .filter(x -> acquisition.isActiveCaseParcel(caseId, x.getCaseParcelId()))
                .orElseThrow(() -> new ResourceNotFoundException("Asset not found: " + assetId));
        if (a.isVoided()) {
            throw new InvalidTransitionException("The asset is already voided");
        }
        requireNoLockedValuation(a.getCaseParcelId());
        a.voidIt(reason.trim());
        AssetRecord saved = assets.saveAndFlush(a);
        audit.record("VOID_ASSET", CASE_ENTITY, caseId, "assetId=" + assetId + ", reason=" + reason.trim());
        return toResponse(saved);
    }

    // ------------------------------------------------------------------ estimates

    public List<ValuationResponse> listForCase(UUID caseId, CurrentActor actor) {
        requireCase(caseId, actor);
        return valuations.findByCaseIdOrderByCaseParcelIdAscVersionNoDesc(caseId).stream().map(v -> toResponse(v, actor)).toList();
    }

    public ValuationResponse get(UUID id, CurrentActor actor) {
        return toResponse(load(id, actor), actor);
    }

    /** Computes (or recomputes a draft) with the approved rate and rule set valid on the reference date. */
    @Transactional
    public ValuationResponse compute(UUID caseId, UUID caseParcelId, CurrentActor actor) {
        CaseRef c = requireCase(caseId, actor);
        if (!VALUATION_CASE_STATUSES.contains(c.status())) {
            throw new InvalidTransitionException("Compensation can be estimated only after the award is declared");
        }
        AwardLineRef line = acquisition.awardLines(caseId).stream().filter(l -> l.caseParcelId().equals(caseParcelId))
                .findFirst().orElseThrow(() -> new InvalidRequestException("The parcel has no award line in this case"));
        Valuation previous = valuations.findFirstByCaseParcelIdAndStatusIn(caseParcelId, LIVE).orElse(null);
        if (previous != null && previous.getStatus() != ValuationStatus.DRAFT) {
            throw new InvalidTransitionException("The parcel already has a " + previous.getStatus()
                    + " estimate; it must be decided first");
        }
        ParcelRef parcel = land.findParcel(line.parcelId())
                .orElseThrow(() -> new ResourceNotFoundException("The parcel record was not found"));
        String classification = land.classificationOf(line.parcelId())
                .orElseThrow(() -> new ResourceNotFoundException("The parcel record was not found"));
        LocalDate referenceDate = acquisition.preliminaryNoticeDate(caseId)
                .orElseThrow(() -> new InvalidRequestException("The case has no preliminary notification date"));
        MarketValueRate rate = rates.findApplicable(parcel.villageId(), classification, referenceDate)
                .orElseThrow(() -> new InvalidRequestException(
                        "No approved market value rate applies to this village and land classification on " + referenceDate));
        Selected selected = ruleSets.selectFor(c.stateId(), c.districtId(), c.framework(), referenceDate);
        BigDecimal assetTotal = assets.findByCaseParcelIdAndVoidedFalse(caseParcelId).stream()
                .map(AssetRecord::getValue).reduce(BigDecimal.ZERO, BigDecimal::add);

        List<CompensationEngine.Component> components = selected.components().stream()
                .map(x -> new CompensationEngine.Component(x.getPosition(), x.getCode(), x.getName(), x.getType(),
                        x.getFactor(), x.baseCodeList()))
                .toList();
        CompensationEngine.Result result;
        try {
            result = CompensationEngine.compute(line.awardedAreaHa(), rate.getRatePerHa(), assetTotal, components);
        } catch (ArithmeticException | IllegalArgumentException e) {
            throw new InvalidRequestException("The estimate could not be calculated: " + e.getMessage());
        }

        if (previous != null) {
            previous.supersede();
            valuations.saveAndFlush(previous);
        }
        int version = valuations.maxVersion(caseParcelId) + 1;
        Valuation saved = valuations.saveAndFlush(new Valuation(caseId, caseParcelId, line.parcelId(), version,
                line.awardedAreaHa(), classification, rate.getId(), rate.getRatePerHa(), selected.ruleSet().getId(),
                selected.ruleSet().getName(), selected.ruleSet().getVersion(), referenceDate, assetTotal, result.total(),
                actor.userId(), actor.username()));
        for (CompensationEngine.Line l : result.lines()) {
            lines.save(new ValuationLine(saved.getId(), l.position(), l.code(), l.name(), l.type(), l.basis(), l.amount()));
        }
        audit.record("COMPUTE", ENTITY, saved.getId(), "caseId=" + caseId + ", version=" + version + ", rules="
                + saved.getRuleSetName() + " v" + saved.getRuleSetVersion() + ", total=" + saved.getTotalAmount());
        return toResponse(saved, actor);
    }

    @Transactional
    public ValuationResponse submit(UUID id, CurrentActor actor) {
        Valuation v = load(id, actor);
        if (v.getStatus() != ValuationStatus.DRAFT) {
            throw new InvalidTransitionException("Only a draft estimate can be submitted");
        }
        v.submit();
        Valuation saved = valuations.saveAndFlush(v);
        CaseRef c = requireCase(v.getCaseId(), actor);
        for (UserRef authority : admin.findUsersByRoleWithDistrictAccess("COMPETENT_AUTHORITY", c.districtId())) {
            notifications.notify(authority.id(), "COMPENSATION", "Estimate awaiting approval",
                    "A compensation estimate of case " + c.caseNumber() + " was submitted.", ENTITY, id);
        }
        audit.record("SUBMIT", ENTITY, id, "total=" + saved.getTotalAmount());
        return toResponse(saved, actor);
    }

    @Transactional
    public ValuationResponse approve(UUID id, String remarks, CurrentActor actor) {
        return decide(id, ValuationStatus.APPROVED, blankToNull(remarks), actor);
    }

    @Transactional
    public ValuationResponse reject(UUID id, String remarks, CurrentActor actor) {
        String reason = blankToNull(remarks);
        if (reason == null) {
            throw new InvalidRequestException("Remarks are required when rejecting an estimate");
        }
        return decide(id, ValuationStatus.REJECTED, reason, actor);
    }

    private ValuationResponse decide(UUID id, ValuationStatus outcome, String remarks, CurrentActor actor) {
        Valuation v = load(id, actor);
        if (v.getStatus() != ValuationStatus.SUBMITTED) {
            throw new InvalidTransitionException("Only a submitted estimate can be approved or rejected");
        }
        if (actor.userId().equals(v.getPreparedByUserId())) {
            throw new AccessDeniedException("The person who prepared an estimate cannot approve or reject it");
        }
        v.decide(outcome, actor.userId(), clock.instant(), remarks);
        Valuation saved = valuations.saveAndFlush(v);
        CaseRef c = requireCase(v.getCaseId(), actor);
        notifications.notify(v.getPreparedByUserId(), "COMPENSATION",
                outcome == ValuationStatus.APPROVED ? "Estimate approved" : "Estimate rejected",
                "Your estimate of case " + c.caseNumber() + " was " + outcome.name().toLowerCase() + ".", ENTITY, id);
        audit.record(outcome == ValuationStatus.APPROVED ? "APPROVE" : "REJECT", ENTITY, id, "total=" + saved.getTotalAmount()
                + (remarks == null ? "" : ", remarks=" + remarks));
        return toResponse(saved, actor);
    }

    // ------------------------------------------------------------------ summary

    public CompensationSummary summary(UUID caseId, CurrentActor actor) {
        CaseRef c = requireCase(caseId, actor);
        Map<UUID, Valuation> live = new HashMap<>();
        for (Valuation v : valuations.findByCaseIdOrderByCaseParcelIdAscVersionNoDesc(caseId)) {
            if (LIVE.contains(v.getStatus())) {
                live.putIfAbsent(v.getCaseParcelId(), v);
            }
        }
        List<SummaryRow> rows = new ArrayList<>();
        int approved = 0;
        int submitted = 0;
        int draft = 0;
        int notEstimated = 0;
        BigDecimal approvedTotal = BigDecimal.ZERO;
        List<AwardLineRef> award = acquisition.awardLines(caseId);
        for (AwardLineRef line : award) {
            Valuation v = live.get(line.caseParcelId());
            if (v == null) {
                notEstimated++;
                rows.add(new SummaryRow(line.caseParcelId(), line.parcelId(), line.awardedAreaHa(), "NOT_ESTIMATED", null, null));
                continue;
            }
            switch (v.getStatus()) {
                case APPROVED -> {
                    approved++;
                    approvedTotal = approvedTotal.add(v.getTotalAmount());
                }
                case SUBMITTED -> submitted++;
                default -> draft++;
            }
            rows.add(new SummaryRow(line.caseParcelId(), line.parcelId(), line.awardedAreaHa(), v.getStatus().name(),
                    v.getId(), v.getTotalAmount()));
        }
        return new CompensationSummary(caseId, c.caseNumber(), award.size(), approved, submitted, draft, notEstimated,
                approvedTotal, rows);
    }

    // ------------------------------------------------------------------ helpers

    private CaseRef requireCase(UUID caseId, CurrentActor actor) {
        return acquisition.findCase(caseId).filter(c -> access.canView(actor, c.districtId()))
                .orElseThrow(() -> new ResourceNotFoundException("Case not found: " + caseId));
    }

    private void requireCaseParcel(UUID caseId, UUID caseParcelId) {
        if (!acquisition.isActiveCaseParcel(caseId, caseParcelId)) {
            throw new ResourceNotFoundException("Affected parcel not found: " + caseParcelId);
        }
    }

    private void requireNoLockedValuation(UUID caseParcelId) {
        if (valuations.findFirstByCaseParcelIdAndStatusIn(caseParcelId, LOCKED).isPresent()) {
            throw new InvalidTransitionException("The parcel has a submitted or approved estimate; assets can no longer change");
        }
    }

    private Valuation load(UUID id, CurrentActor actor) {
        Valuation v = valuations.findById(id).orElseThrow(() -> new ResourceNotFoundException("Estimate not found: " + id));
        requireCase(v.getCaseId(), actor);
        return v;
    }

    private ValuationResponse toResponse(Valuation v, CurrentActor actor) {
        List<LineResponse> lineRows = lines.findByValuationIdOrderByPositionAsc(v.getId()).stream()
                .map(l -> new LineResponse(l.getPosition(), l.getComponentCode(), l.getComponentName(), l.getComponentType(),
                        l.getBasis(), l.getAmount()))
                .toList();
        List<String> actions = new ArrayList<>();
        if (v.getStatus() == ValuationStatus.DRAFT && actor.hasAuthority("VALUATION_MANAGE")) {
            actions.add("SUBMIT");
            actions.add("RECALCULATE");
        }
        if (v.getStatus() == ValuationStatus.SUBMITTED && actor.hasAuthority("VALUATION_APPROVE")
                && !actor.userId().equals(v.getPreparedByUserId())) {
            actions.add("APPROVE");
            actions.add("REJECT");
        }
        return new ValuationResponse(v.getId(), v.getCaseId(), v.getCaseParcelId(), v.getParcelId(), v.getVersionNo(),
                v.getAwardedAreaHa(), v.getClassification(), v.getRatePerHa(), v.getRuleSetName(), v.getRuleSetVersion(),
                v.getReferenceDate(), v.getAssetTotal(), v.getTotalAmount(), v.getStatus(), v.getPreparedByUsername(),
                v.getDecidedByUserId(), v.getDecidedAt(), v.getDecisionRemarks(), v.getCreatedAt(), lineRows, actions);
    }

    private static AssetResponse toResponse(AssetRecord a) {
        return new AssetResponse(a.getId(), a.getCaseParcelId(), a.getCategory(), a.getDescription(), a.getQuantity(),
                a.getUnit(), a.getUnitValue(), a.getValue(), a.isVoided(), a.getVoidReason());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}