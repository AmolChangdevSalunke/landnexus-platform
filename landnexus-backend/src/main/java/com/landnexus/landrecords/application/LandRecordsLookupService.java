package com.landnexus.landrecords.application;

import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.landrecords.domain.ParcelOwnership;
import com.landnexus.landrecords.infrastructure.LandParcelRepository;
import com.landnexus.landrecords.infrastructure.ParcelOwnershipRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The published, read-only API other modules use to ask about parcels. It never exposes personal data (ids only). */
@Service
@Transactional(readOnly = true)
public class LandRecordsLookupService {

    public record ParcelRef(UUID id, UUID villageId, UUID districtId, BigDecimal areaHa, boolean active) {
    }

    public record OwnerShareRef(UUID landownerId, BigDecimal sharePercent) {
    }

    private final LandParcelRepository parcels;
    private final ParcelOwnershipRepository ownerships;

    public LandRecordsLookupService(LandParcelRepository parcels, ParcelOwnershipRepository ownerships) {
        this.parcels = parcels;
        this.ownerships = ownerships;
    }

    public Optional<ParcelRef> findParcel(UUID id) {
        return parcels.findById(id).map(p -> new ParcelRef(p.getId(), p.getVillageId(), p.getDistrictId(),
                p.getAreaHa(), p.getStatus() == ParcelStatus.ACTIVE));
    }

    public List<OwnerShareRef> currentOwners(UUID parcelId) {
        return ownerships.findByParcelIdAndToDateIsNull(parcelId).stream()
                .map((ParcelOwnership o) -> new OwnerShareRef(o.getLandownerId(), o.getSharePercent()))
                .toList();
    }
}