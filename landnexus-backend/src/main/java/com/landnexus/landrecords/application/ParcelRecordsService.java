package com.landnexus.landrecords.application;

import com.landnexus.landrecords.api.dto.LandDtos.MutationRequest;
import com.landnexus.landrecords.api.dto.LandDtos.MutationResponse;
import com.landnexus.landrecords.api.dto.LandDtos.RevenueRecordRequest;
import com.landnexus.landrecords.api.dto.LandDtos.RevenueRecordResponse;
import com.landnexus.landrecords.domain.LandParcel;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.landrecords.domain.LandTypes.RevenueRecordType;
import com.landnexus.landrecords.domain.ParcelMutation;
import com.landnexus.landrecords.domain.RevenueRecord;
import com.landnexus.landrecords.infrastructure.LandParcelRepository;
import com.landnexus.landrecords.infrastructure.ParcelMutationRepository;
import com.landnexus.landrecords.infrastructure.RevenueRecordRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Mutation entries and 7/12, 8A extracts typed in by officers. Never edited: a correction is a new entry. */
@Service
@Transactional(readOnly = true)
public class ParcelRecordsService {

    private final LandParcelRepository parcels;
    private final ParcelMutationRepository mutations;
    private final RevenueRecordRepository revenueRecords;
    private final LandAccess access;
    private final AuditService audit;

    public ParcelRecordsService(LandParcelRepository parcels, ParcelMutationRepository mutations,
                                RevenueRecordRepository revenueRecords, LandAccess access, AuditService audit) {
        this.parcels = parcels;
        this.mutations = mutations;
        this.revenueRecords = revenueRecords;
        this.access = access;
        this.audit = audit;
    }

    public List<MutationResponse> listMutations(UUID parcelId, CurrentActor actor) {
        loadVisible(parcelId, actor);
        return mutations.findByParcelIdOrderByMutationDateDesc(parcelId).stream().map(MutationResponse::from).toList();
    }

    @Transactional
    public MutationResponse addMutation(UUID parcelId, MutationRequest request, CurrentActor actor) {
        requireActive(loadVisible(parcelId, actor));
        String number = request.mutationNumber().trim().toUpperCase(Locale.ROOT);
        if (mutations.existsByParcelIdAndMutationNumber(parcelId, number)) {
            throw new DuplicateResourceException("Mutation number " + number + " already exists for this parcel");
        }
        ParcelMutation saved = mutations.saveAndFlush(new ParcelMutation(parcelId, number, request.mutationDate(),
                request.mutationType(), blankToNull(request.description())));
        audit.record("ADD_MUTATION", "LandParcel", parcelId,
                "mutation=" + number + ", type=" + saved.getMutationType() + ", date=" + saved.getMutationDate());
        return MutationResponse.from(saved);
    }

    public List<RevenueRecordResponse> listRevenueRecords(UUID parcelId, CurrentActor actor) {
        loadVisible(parcelId, actor);
        return revenueRecords.findByParcelIdOrderByExtractDateDesc(parcelId).stream()
                .map(RevenueRecordResponse::from).toList();
    }

    @Transactional
    public RevenueRecordResponse addRevenueRecord(UUID parcelId, RevenueRecordRequest request, CurrentActor actor) {
        requireActive(loadVisible(parcelId, actor));
        String khata = blankToNull(request.khataNumber());
        if (request.recordType() == RevenueRecordType.EIGHT_A && khata == null) {
            throw new InvalidRequestException("The khata number is required for an 8A record");
        }
        if (revenueRecords.existsByParcelIdAndRecordTypeAndExtractDate(parcelId, request.recordType(),
                request.extractDate())) {
            throw new DuplicateResourceException("A " + request.recordType() + " record for " + request.extractDate()
                    + " already exists for this parcel");
        }
        RevenueRecord saved = revenueRecords.saveAndFlush(new RevenueRecord(parcelId, request.recordType(),
                request.extractDate(), khata == null ? null : khata.toUpperCase(Locale.ROOT),
                request.particulars().trim()));
        audit.record("ADD_REVENUE_RECORD", "LandParcel", parcelId,
                "type=" + saved.getRecordType() + ", extractDate=" + saved.getExtractDate());
        return RevenueRecordResponse.from(saved);
    }

    private LandParcel loadVisible(UUID parcelId, CurrentActor actor) {
        return parcels.findById(parcelId)
                .filter(p -> access.canView(actor, p.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Parcel not found: " + parcelId));
    }

    private static void requireActive(LandParcel parcel) {
        if (parcel.getStatus() != ParcelStatus.ACTIVE) {
            throw new InvalidTransitionException("An inactive parcel cannot be changed; activate it first");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}