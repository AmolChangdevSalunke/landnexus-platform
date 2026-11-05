package com.landnexus.landrecords.api;

import com.landnexus.landrecords.api.dto.LandDtos.MutationRequest;
import com.landnexus.landrecords.api.dto.LandDtos.MutationResponse;
import com.landnexus.landrecords.api.dto.LandDtos.OwnershipEndRequest;
import com.landnexus.landrecords.api.dto.LandDtos.OwnershipRequest;
import com.landnexus.landrecords.api.dto.LandDtos.OwnershipResponse;
import com.landnexus.landrecords.api.dto.LandDtos.RevenueRecordRequest;
import com.landnexus.landrecords.api.dto.LandDtos.RevenueRecordResponse;
import com.landnexus.landrecords.application.OwnershipService;
import com.landnexus.landrecords.application.ParcelRecordsService;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Ownership, mutation and 7/12, 8A records of one parcel. */
@RestController
@RequestMapping("/api/v1/land-records/parcels/{parcelId}")
public class ParcelRecordsController {

    private final OwnershipService ownerships;
    private final ParcelRecordsService records;

    public ParcelRecordsController(OwnershipService ownerships, ParcelRecordsService records) {
        this.ownerships = ownerships;
        this.records = records;
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_READ')")
    @GetMapping("/ownerships")
    public List<OwnershipResponse> listOwnerships(@PathVariable UUID parcelId, Authentication a) {
        return ownerships.list(parcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping("/ownerships")
    @ResponseStatus(HttpStatus.CREATED)
    public OwnershipResponse addOwnership(@PathVariable UUID parcelId, @Valid @RequestBody OwnershipRequest request,
                                          Authentication a) {
        return ownerships.add(parcelId, request, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping("/ownerships/{ownershipId}/end")
    public OwnershipResponse endOwnership(@PathVariable UUID parcelId, @PathVariable UUID ownershipId,
                                          @Valid @RequestBody OwnershipEndRequest request, Authentication a) {
        return ownerships.end(parcelId, ownershipId, request, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_READ')")
    @GetMapping("/mutations")
    public List<MutationResponse> listMutations(@PathVariable UUID parcelId, Authentication a) {
        return records.listMutations(parcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping("/mutations")
    @ResponseStatus(HttpStatus.CREATED)
    public MutationResponse addMutation(@PathVariable UUID parcelId, @Valid @RequestBody MutationRequest request,
                                        Authentication a) {
        return records.addMutation(parcelId, request, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_READ')")
    @GetMapping("/revenue-records")
    public List<RevenueRecordResponse> listRevenueRecords(@PathVariable UUID parcelId, Authentication a) {
        return records.listRevenueRecords(parcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping("/revenue-records")
    @ResponseStatus(HttpStatus.CREATED)
    public RevenueRecordResponse addRevenueRecord(@PathVariable UUID parcelId,
                                                  @Valid @RequestBody RevenueRecordRequest request, Authentication a) {
        return records.addRevenueRecord(parcelId, request, CurrentActor.from(a));
    }
}