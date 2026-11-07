package com.landnexus.compensation.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.VillageDetailRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.compensation.api.dto.CompensationDtos.RateRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.RateResponse;
import com.landnexus.compensation.domain.CompTypes.RateStatus;
import com.landnexus.compensation.domain.MarketValueRate;
import com.landnexus.compensation.infrastructure.MarketValueRateRepository;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Market value rates: entered by one person, approved by another. An approved rate is never changed. */
@Service
@Transactional(readOnly = true)
public class RateService {

    private static final String ENTITY = "MarketValueRate";

    private final MarketValueRateRepository rates;
    private final AdministrationLookupService admin;
    private final LandRecordsLookupService land;
    private final GeoScopeService geoScope;
    private final CompensationAccess access;
    private final AuditService audit;
    private final Clock clock;

    public RateService(MarketValueRateRepository rates, AdministrationLookupService admin, LandRecordsLookupService land,
                       GeoScopeService geoScope, CompensationAccess access, AuditService audit, Clock clock) {
        this.rates = rates;
        this.admin = admin;
        this.land = land;
        this.geoScope = geoScope;
        this.access = access;
        this.audit = audit;
        this.clock = clock;
    }

    public PageResponse<RateResponse> list(UUID villageId, RateStatus status, int page, int size, CurrentActor actor) {
        Specification<MarketValueRate> spec = access.visibleTo(actor);
        if (villageId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("villageId"), villageId));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        Page<MarketValueRate> result = rates.findAll(spec, PageParams.ofDescending(page, size, "createdAt"));
        return PageResponse.from(result, RateService::toResponse);
    }

    @Transactional
    public RateResponse create(RateRequest request, CurrentActor actor) {
        VillageDetailRef village = admin.findActiveVillageDetail(request.villageId())
                .orElseThrow(() -> new InvalidRequestException("Unknown or inactive village: " + request.villageId()));
        geoScope.requireDistrictAccess(actor, village.districtId());
        String classification = request.classification().trim().toUpperCase(Locale.ROOT);
        if (!land.classifications().contains(classification)) {
            throw new InvalidRequestException("Unknown land classification: " + classification);
        }
        if (rates.existsByVillageIdAndClassificationAndEffectiveFromAndStatusNot(village.id(), classification,
                request.effectiveFrom(), RateStatus.REJECTED)) {
            throw new DuplicateResourceException("A rate for this village, classification and date already exists");
        }
        MarketValueRate saved = rates.saveAndFlush(new MarketValueRate(village.id(), village.districtId(), classification,
                request.ratePerHa(), request.effectiveFrom(), blankToNull(request.sourceNote()), actor.userId()));
        audit.record("CREATE", ENTITY, saved.getId(), "village=" + village.id() + ", classification=" + classification
                + ", ratePerHa=" + saved.getRatePerHa() + ", effectiveFrom=" + saved.getEffectiveFrom());
        return toResponse(saved);
    }

    @Transactional
    public RateResponse approve(UUID id, String remarks, CurrentActor actor) {
        return decide(id, RateStatus.APPROVED, blankToNull(remarks), actor);
    }

    @Transactional
    public RateResponse reject(UUID id, String remarks, CurrentActor actor) {
        String reason = blankToNull(remarks);
        if (reason == null) {
            throw new InvalidRequestException("Remarks are required when rejecting a rate");
        }
        return decide(id, RateStatus.REJECTED, reason, actor);
    }

    private RateResponse decide(UUID id, RateStatus outcome, String remarks, CurrentActor actor) {
        MarketValueRate rate = rates.findById(id).filter(r -> access.canView(actor, r.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Rate not found: " + id));
        if (rate.getStatus() != RateStatus.PENDING) {
            throw new InvalidTransitionException("Only a pending rate can be approved or rejected");
        }
        if (actor.userId().equals(rate.getCreatedByUserId())) {
            throw new AccessDeniedException("The person who entered a rate cannot approve or reject it");
        }
        rate.decide(outcome, actor.userId(), clock.instant(), remarks);
        MarketValueRate saved = rates.saveAndFlush(rate);
        audit.record(outcome == RateStatus.APPROVED ? "APPROVE" : "REJECT", ENTITY, id, "ratePerHa=" + saved.getRatePerHa());
        return toResponse(saved);
    }

    /** The newest approved rate that was already valid on the reference date. */
    public Optional<MarketValueRate> findApplicable(UUID villageId, String classification, LocalDate referenceDate) {
        return rates.findFirstByVillageIdAndClassificationAndStatusAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
                villageId, classification, RateStatus.APPROVED, referenceDate);
    }

    private static RateResponse toResponse(MarketValueRate r) {
        return new RateResponse(r.getId(), r.getVillageId(), r.getDistrictId(), r.getClassification(), r.getRatePerHa(),
                r.getEffectiveFrom(), r.getSourceNote(), r.getStatus(), r.getCreatedByUserId(), r.getApprovedByUserId(),
                r.getDecidedAt(), r.getDecisionRemarks());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}