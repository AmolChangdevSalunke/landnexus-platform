package com.landnexus.landrecords.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.landrecords.api.dto.LandDtos.OwnershipEndRequest;
import com.landnexus.landrecords.api.dto.LandDtos.OwnershipRequest;
import com.landnexus.landrecords.api.dto.LandDtos.OwnershipResponse;
import com.landnexus.landrecords.domain.LandParcel;
import com.landnexus.landrecords.domain.LandTypes.OwnerType;
import com.landnexus.landrecords.domain.LandTypes.OwnershipBasis;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class OwnershipServiceTest {

    @Mock private LandParcelRepository parcels;
    @Mock private LandownerRepository landowners;
    @Mock private ParcelOwnershipRepository ownerships;
    @Mock private LandAccess access;
    @Mock private AuditService audit;

    private OwnershipService service;

    private final UUID parcelId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final UUID ownerId = UUID.randomUUID();
    private final CurrentActor officer = new CurrentActor(UUID.randomUUID(), "officer", Set.of("FIELD_OFFICER"),
            Set.of("LAND_RECORD_READ", "LAND_RECORD_WRITE", "LANDOWNER_READ"));
    private final CurrentActor finance = new CurrentActor(UUID.randomUUID(), "finance", Set.of("FINANCE_OFFICER"),
            Set.of("LAND_RECORD_READ"));

    @BeforeEach
    void setUp() {
        service = new OwnershipService(parcels, landowners, ownerships, access, audit);
        lenient().when(access.canView(any(), any())).thenReturn(true);
        lenient().when(ownerships.saveAndFlush(any(ParcelOwnership.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private LandParcel parcel(ParcelStatus status) {
        LandParcel p = new LandParcel();
        ReflectionTestUtils.setField(p, "id", parcelId);
        p.setDistrictId(districtId);
        p.setStatus(status);
        return p;
    }

    private void stubLockedParcel(ParcelStatus status) {
        when(parcels.findByIdForUpdate(parcelId)).thenReturn(Optional.of(parcel(status)));
    }

    private Landowner owner(UUID district) {
        Landowner o = new Landowner();
        ReflectionTestUtils.setField(o, "id", ownerId);
        o.setDistrictId(district);
        o.setOwnerType(OwnerType.INDIVIDUAL);
        o.setFullName("DEMO Owner One");
        return o;
    }

    private OwnershipRequest request(String share) {
        return new OwnershipRequest(ownerId, new BigDecimal(share), OwnershipBasis.ORIGINAL, LocalDate.of(2020, 1, 1), null);
    }

    private ParcelOwnership existing(String share) {
        return new ParcelOwnership(parcelId, UUID.randomUUID(), new BigDecimal(share), OwnershipBasis.ORIGINAL,
                LocalDate.of(2019, 1, 1), null);
    }

    @Test
    void add_withinOneHundredPercent_isSaved_andAudited() {
        stubLockedParcel(ParcelStatus.ACTIVE);
        when(landowners.findById(ownerId)).thenReturn(Optional.of(owner(districtId)));
        when(ownerships.findByParcelIdAndToDateIsNull(parcelId)).thenReturn(List.of(existing("60")));

        OwnershipResponse response = service.add(parcelId, request("40"), officer);

        assertThat(response.sharePercent()).isEqualByComparingTo("40");
        assertThat(response.current()).isTrue();
        verify(audit).record(eq("ADD_OWNER"), eq("LandParcel"), eq(parcelId), anyString());
    }

    @Test
    void add_pushingTheTotalAboveOneHundred_isRejected() {
        stubLockedParcel(ParcelStatus.ACTIVE);
        when(landowners.findById(ownerId)).thenReturn(Optional.of(owner(districtId)));
        when(ownerships.findByParcelIdAndToDateIsNull(parcelId)).thenReturn(List.of(existing("60")));

        assertThatThrownBy(() -> service.add(parcelId, request("50"), officer))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("100%");
        verify(ownerships, never()).saveAndFlush(any());
    }

    @Test
    void add_landownerOfAnotherDistrict_isRejected() {
        stubLockedParcel(ParcelStatus.ACTIVE);
        when(landowners.findById(ownerId)).thenReturn(Optional.of(owner(UUID.randomUUID())));

        assertThatThrownBy(() -> service.add(parcelId, request("10"), officer)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void add_sameCurrentOwnerTwice_isAConflict() {
        stubLockedParcel(ParcelStatus.ACTIVE);
        when(landowners.findById(ownerId)).thenReturn(Optional.of(owner(districtId)));
        when(ownerships.existsByParcelIdAndLandownerIdAndToDateIsNull(parcelId, ownerId)).thenReturn(true);

        assertThatThrownBy(() -> service.add(parcelId, request("10"), officer)).isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void add_toAnInactiveParcel_isAConflict() {
        stubLockedParcel(ParcelStatus.INACTIVE);

        assertThatThrownBy(() -> service.add(parcelId, request("10"), officer)).isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void add_parcelOutsideTheCallersScope_isNotFound() {
        stubLockedParcel(ParcelStatus.ACTIVE);
        when(access.canView(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service.add(parcelId, request("10"), officer)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void end_beforeTheStartDate_isRejected() {
        stubLockedParcel(ParcelStatus.ACTIVE);
        ParcelOwnership o = existing("100");
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(o, "id", id);
        when(ownerships.findById(id)).thenReturn(Optional.of(o));

        assertThatThrownBy(() -> service.end(parcelId, id, new OwnershipEndRequest(LocalDate.of(2018, 1, 1)), officer))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void end_closesTheOwnership_andARepeatIsAConflict() {
        stubLockedParcel(ParcelStatus.ACTIVE);
        ParcelOwnership o = existing("100");
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(o, "id", id);
        when(ownerships.findById(id)).thenReturn(Optional.of(o));

        OwnershipResponse response = service.end(parcelId, id, new OwnershipEndRequest(LocalDate.of(2024, 1, 1)), officer);

        assertThat(response.current()).isFalse();
        assertThatThrownBy(() -> service.end(parcelId, id, new OwnershipEndRequest(LocalDate.of(2024, 2, 1)), officer))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void list_masksOwnerNames_withoutLandownerRead_andDoesNotAudit() {
        when(parcels.findById(parcelId)).thenReturn(Optional.of(parcel(ParcelStatus.ACTIVE)));
        ParcelOwnership row = existing("100");
        when(ownerships.findByParcelIdOrderByFromDateAsc(parcelId)).thenReturn(List.of(row));

        List<OwnershipResponse> result = service.list(parcelId, finance);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).ownerName()).isNull();
        assertThat(result.get(0).ownerType()).isNull();
        verify(audit, never()).record(any(), any(), any(), any());
    }

    @Test
    void list_showsOwnerNames_toLandownerReaders_andAudits() {
        when(parcels.findById(parcelId)).thenReturn(Optional.of(parcel(ParcelStatus.ACTIVE)));
        ParcelOwnership row = new ParcelOwnership(parcelId, ownerId, new BigDecimal("100"), OwnershipBasis.ORIGINAL,
                LocalDate.of(2019, 1, 1), null);
        when(ownerships.findByParcelIdOrderByFromDateAsc(parcelId)).thenReturn(List.of(row));
        when(landowners.findAllById(any())).thenReturn(List.of(owner(districtId)));

        List<OwnershipResponse> result = service.list(parcelId, officer);

        assertThat(result.get(0).ownerName()).isEqualTo("DEMO Owner One");
        verify(audit).record(eq("VIEW_OWNERS"), eq("LandParcel"), eq(parcelId), anyString());
    }
}