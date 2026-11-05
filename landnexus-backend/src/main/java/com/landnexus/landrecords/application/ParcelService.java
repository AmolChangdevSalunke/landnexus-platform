package com.landnexus.landrecords.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.VillageDetailRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.landrecords.api.dto.LandDtos.ParcelRequest;
import com.landnexus.landrecords.api.dto.LandDtos.ParcelResponse;
import com.landnexus.landrecords.domain.LandParcel;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.landrecords.infrastructure.LandParcelRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Land parcels. Every read and write is limited to the caller's geographic scope. */
@Service
@Transactional(readOnly = true)
public class ParcelService {

    private static final String ENTITY = "LandParcel";
    private static final String DUPLICATE = "A parcel with this Gat / Survey / Subdivision number already exists in the village";

    private final LandParcelRepository parcels;
    private final AdministrationLookupService lookup;
    private final GeoScopeService geoScope;
    private final LandAccess access;
    private final AuditService audit;

    public ParcelService(LandParcelRepository parcels, AdministrationLookupService lookup, GeoScopeService geoScope,
                         LandAccess access, AuditService audit) {
        this.parcels = parcels;
        this.lookup = lookup;
        this.geoScope = geoScope;
        this.access = access;
        this.audit = audit;
    }

    public ParcelResponse get(UUID id, CurrentActor actor) {
        return ParcelResponse.from(loadVisible(id, actor));
    }

    public PageResponse<ParcelResponse> list(UUID districtId, UUID villageId, String number, int page, int size,
                                             CurrentActor actor) {
        Specification<LandParcel> spec = access.visibleTo(actor);
        if (districtId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("districtId"), districtId));
        }
        if (villageId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("villageId"), villageId));
        }
        if (number != null && !number.isBlank()) {
            String key = number.trim().toUpperCase(Locale.ROOT);
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.equal(root.get("gatNumber"), key), cb.equal(root.get("surveyNumber"), key)));
        }
        Page<LandParcel> result = parcels.findAll(spec, PageParams.ofDescending(page, size, "createdAt"));
        return PageResponse.from(result, ParcelResponse::from);
    }

    @Transactional
    public ParcelResponse create(ParcelRequest request, CurrentActor actor) {
        VillageDetailRef village = lookup.findActiveVillageDetail(request.villageId())
                .orElseThrow(() -> new InvalidRequestException("Unknown or inactive village: " + request.villageId()));
        geoScope.requireDistrictAccess(actor, village.districtId());

        String gat = normalise(request.gatNumber());
        String survey = normalise(request.surveyNumber());
        String subdivision = normalise(request.subdivisionNumber());
        requireIdentifier(gat, survey);
        String key = parcelKey(gat, survey, subdivision);
        if (parcels.existsByVillageIdAndParcelKey(village.id(), key)) {
            throw new DuplicateResourceException(DUPLICATE);
        }

        LandParcel parcel = new LandParcel();
        parcel.setStateId(village.stateId());
        parcel.setDistrictId(village.districtId());
        parcel.setTalukaId(village.talukaId());
        parcel.setVillageId(village.id());
        fill(parcel, gat, survey, subdivision, key, request);
        LandParcel saved = parcels.saveAndFlush(parcel);
        audit.record("CREATE", ENTITY, saved.getId(), describe(saved));
        return ParcelResponse.from(saved);
    }

    @Transactional
    public ParcelResponse update(UUID id, ParcelRequest request, CurrentActor actor) {
        LandParcel parcel = loadVisible(id, actor);
        if (parcel.getStatus() != ParcelStatus.ACTIVE) {
            throw new InvalidTransitionException("An inactive parcel cannot be changed; activate it first");
        }
        if (!parcel.getVillageId().equals(request.villageId())) {
            throw new InvalidRequestException("A parcel cannot be moved to another village");
        }
        String gat = normalise(request.gatNumber());
        String survey = normalise(request.surveyNumber());
        String subdivision = normalise(request.subdivisionNumber());
        requireIdentifier(gat, survey);
        String key = parcelKey(gat, survey, subdivision);
        if (parcels.existsByVillageIdAndParcelKeyAndIdNot(parcel.getVillageId(), key, parcel.getId())) {
            throw new DuplicateResourceException(DUPLICATE);
        }
        String before = describe(parcel);
        fill(parcel, gat, survey, subdivision, key, request);
        LandParcel saved = parcels.saveAndFlush(parcel);
        audit.record("UPDATE", ENTITY, saved.getId(), "before: " + before + " | after: " + describe(saved));
        return ParcelResponse.from(saved);
    }

    @Transactional
    public ParcelResponse setStatus(UUID id, ParcelStatus status, CurrentActor actor) {
        LandParcel parcel = loadVisible(id, actor);
        parcel.setStatus(status);
        LandParcel saved = parcels.saveAndFlush(parcel);
        audit.record(status == ParcelStatus.ACTIVE ? "ACTIVATE" : "DEACTIVATE", ENTITY, saved.getId(), describe(saved));
        return ParcelResponse.from(saved);
    }

    private LandParcel loadVisible(UUID id, CurrentActor actor) {
        LandParcel parcel = parcels.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Parcel not found: " + id));
        if (!access.canView(actor, parcel.getDistrictId())) {
            throw new ResourceNotFoundException("Parcel not found: " + id);
        }
        return parcel;
    }

    private static void fill(LandParcel parcel, String gat, String survey, String subdivision, String key,
                             ParcelRequest request) {
        parcel.setGatNumber(gat);
        parcel.setSurveyNumber(survey);
        parcel.setSubdivisionNumber(subdivision);
        parcel.setParcelKey(key);
        parcel.setAreaHa(request.areaHa());
        parcel.setClassification(request.classification());
        parcel.setLandUse(request.landUse());
    }

    private static String normalise(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static void requireIdentifier(String gat, String survey) {
        if (gat == null && survey == null) {
            throw new InvalidRequestException("Either a Gat number or a Survey number is required");
        }
    }

    static String parcelKey(String gat, String survey, String subdivision) {
        return (gat == null ? "" : gat) + "|" + (survey == null ? "" : survey) + "|"
                + (subdivision == null ? "" : subdivision);
    }

    private static String describe(LandParcel p) {
        return "villageId=" + p.getVillageId() + ", gat=" + p.getGatNumber() + ", survey=" + p.getSurveyNumber()
                + ", subdivision=" + p.getSubdivisionNumber() + ", areaHa=" + p.getAreaHa()
                + ", classification=" + p.getClassification() + ", landUse=" + p.getLandUse()
                + ", status=" + p.getStatus();
    }
}