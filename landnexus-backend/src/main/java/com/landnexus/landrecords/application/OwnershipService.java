package com.landnexus.landrecords.application;

import com.landnexus.landrecords.api.dto.LandDtos.OwnershipEndRequest;
import com.landnexus.landrecords.api.dto.LandDtos.OwnershipRequest;
import com.landnexus.landrecords.api.dto.LandDtos.OwnershipResponse;
import com.landnexus.landrecords.domain.LandParcel;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.landrecords.domain.Landowner;
import com.landnexus.landrecords.domain.ParcelOwnership;
import com.landnexus.landrecords.infrastructure.LandParcelRepository;
import com.landnexus.landrecords.infrastructure.LandownerRepository;
import com.landnexus.landrecords.infrastructure.ParcelOwnershipRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Who owns a parcel. Owner names are masked for callers without LANDOWNER_READ. */
@Service
@Transactional(readOnly = true)
public class OwnershipService {

    static final BigDecimal HUNDRED = new BigDecimal("100.00");
    static final String LANDOWNER_READ = "LANDOWNER_READ";

    private final LandParcelRepository parcels;
    private final LandownerRepository landowners;
    private final ParcelOwnershipRepository ownerships;
    private final LandAccess access;
    private final AuditService audit;

    public OwnershipService(LandParcelRepository parcels, LandownerRepository landowners,
                            ParcelOwnershipRepository ownerships, LandAccess access, AuditService audit) {
        this.parcels = parcels;
        this.landowners = landowners;
        this.ownerships = ownerships;
        this.access = access;
        this.audit = audit;
    }

    /** Seeing owner names is audited, so this is a read-write transaction. */
    @Transactional
    public List<OwnershipResponse> list(UUID parcelId, CurrentActor actor) {
        LandParcel parcel = parcels.findById(parcelId)
                .filter(p -> access.canView(actor, p.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Parcel not found: " + parcelId));
        List<ParcelOwnership> rows = ownerships.findByParcelIdOrderByFromDateAsc(parcel.getId());
        boolean showOwners = actor.hasAuthority(LANDOWNER_READ);
        Map<UUID, Landowner> byId = new HashMap<>();
        if (showOwners && !rows.isEmpty()) {
            Set<UUID> ids = rows.stream().map(ParcelOwnership::getLandownerId).collect(Collectors.toSet());
            landowners.findAllById(ids).forEach(o -> byId.put(o.getId(), o));
            audit.record("VIEW_OWNERS", "LandParcel", parcel.getId(), "owners of the parcel were viewed");
        }
        return rows.stream().map(o -> toResponse(o, showOwners ? byId.get(o.getLandownerId()) : null)).toList();
    }

    @Transactional
    public OwnershipResponse add(UUID parcelId, OwnershipRequest request, CurrentActor actor) {
        LandParcel parcel = lockVisible(parcelId, actor);
        requireActive(parcel);
        Landowner owner = landowners.findById(request.landownerId())
                .orElseThrow(() -> new InvalidRequestException("Unknown landowner: " + request.landownerId()));
        if (!owner.getDistrictId().equals(parcel.getDistrictId())) {
            throw new InvalidRequestException("The landowner is registered in another district than the parcel");
        }
        if (ownerships.existsByParcelIdAndLandownerIdAndToDateIsNull(parcelId, owner.getId())) {
            throw new DuplicateResourceException("This landowner is already a current owner of the parcel");
        }
        BigDecimal total = ownerships.findByParcelIdAndToDateIsNull(parcelId).stream()
                .map(ParcelOwnership::getSharePercent)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.add(request.sharePercent()).compareTo(HUNDRED) > 0) {
            throw new InvalidRequestException("Current ownership shares would exceed 100% (they are now "
                    + total.stripTrailingZeros().toPlainString() + "%)");
        }
        ParcelOwnership saved = ownerships.saveAndFlush(new ParcelOwnership(parcelId, owner.getId(),
                request.sharePercent(), request.basis(), request.fromDate(), blankToNull(request.remarks())));
        audit.record("ADD_OWNER", "LandParcel", parcelId, "landownerId=" + owner.getId()
                + ", share=" + saved.getSharePercent() + "%, basis=" + saved.getBasis());
        return toResponse(saved, owner);
    }

    @Transactional
    public OwnershipResponse end(UUID parcelId, UUID ownershipId, OwnershipEndRequest request, CurrentActor actor) {
        lockVisible(parcelId, actor);
        ParcelOwnership ownership = ownerships.findById(ownershipId)
                .filter(o -> o.getParcelId().equals(parcelId))
                .orElseThrow(() -> new ResourceNotFoundException("Ownership not found: " + ownershipId));
        if (!ownership.isCurrent()) {
            throw new InvalidTransitionException("This ownership has already ended");
        }
        if (request.endDate().isBefore(ownership.getFromDate())) {
            throw new InvalidRequestException("The end date cannot be before the start date");
        }
        ownership.setToDate(request.endDate());
        ParcelOwnership saved = ownerships.saveAndFlush(ownership);
        audit.record("END_OWNERSHIP", "LandParcel", parcelId, "ownershipId=" + ownershipId
                + ", landownerId=" + saved.getLandownerId() + ", endDate=" + request.endDate());
        return toResponse(saved, null);
    }

    private LandParcel lockVisible(UUID parcelId, CurrentActor actor) {
        return parcels.findByIdForUpdate(parcelId)
                .filter(p -> access.canView(actor, p.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Parcel not found: " + parcelId));
    }

    private static void requireActive(LandParcel parcel) {
        if (parcel.getStatus() != ParcelStatus.ACTIVE) {
            throw new InvalidTransitionException("An inactive parcel cannot be changed; activate it first");
        }
    }

    private static OwnershipResponse toResponse(ParcelOwnership o, Landowner owner) {
        return new OwnershipResponse(o.getId(), o.getParcelId(), o.getLandownerId(),
                owner == null ? null : owner.getFullName(), owner == null ? null : owner.getOwnerType(),
                o.getSharePercent(), o.getBasis(), o.getFromDate(), o.getToDate(), o.isCurrent(), o.getRemarks());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}