package com.landnexus.landrecords.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.VillageDetailRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.landrecords.api.dto.LandDtos.ParcelRequest;
import com.landnexus.landrecords.api.dto.LandDtos.ParcelResponse;
import com.landnexus.landrecords.domain.LandParcel;
import com.landnexus.landrecords.domain.LandTypes.LandClassification;
import com.landnexus.landrecords.domain.LandTypes.LandUse;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.landrecords.infrastructure.LandParcelRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ParcelServiceTest {

    @Mock private LandParcelRepository parcels;
    @Mock private AdministrationLookupService lookup;
    @Mock private GeoScopeService geoScope;
    @Mock private LandAccess access;
    @Mock private AuditService audit;

    private ParcelService service;

    private final UUID villageId = UUID.randomUUID();
    private final UUID talukaId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final UUID stateId = UUID.randomUUID();
    private final UUID parcelId = UUID.randomUUID();
    private final CurrentActor officer = new CurrentActor(UUID.randomUUID(), "officer", Set.of("FIELD_OFFICER"),
            Set.of("LAND_RECORD_READ", "LAND_RECORD_WRITE"));

    @BeforeEach
    void setUp() {
        service = new ParcelService(parcels, lookup, geoScope, access, audit);
        lenient().when(parcels.saveAndFlush(any(LandParcel.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(access.canView(any(), any())).thenReturn(true);
    }

    private ParcelRequest request(String gat, String survey) {
        return new ParcelRequest(villageId, gat, survey, null, new BigDecimal("1.5"),
                LandClassification.AGRICULTURAL_DRY, LandUse.CULTIVATION);
    }

    private void stubVillage() {
        when(lookup.findActiveVillageDetail(villageId))
                .thenReturn(Optional.of(new VillageDetailRef(villageId, "V", talukaId, districtId, stateId)));
    }

    private LandParcel stored(ParcelStatus status) {
        LandParcel p = new LandParcel();
        ReflectionTestUtils.setField(p, "id", parcelId);
        p.setVillageId(villageId);
        p.setDistrictId(districtId);
        p.setStatus(status);
        p.setGatNumber("12");
        when(parcels.findById(parcelId)).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    void create_normalisesNumbers_placesTheParcelFromTheVillage_andAudits() {
        stubVillage();

        ParcelResponse response = service.create(request(" 12/a ", null), officer);

        assertThat(response.gatNumber()).isEqualTo("12/A");
        assertThat(response.surveyNumber()).isNull();
        assertThat(response.districtId()).isEqualTo(districtId);
        assertThat(response.stateId()).isEqualTo(stateId);
        assertThat(response.talukaId()).isEqualTo(talukaId);
        verify(parcels).existsByVillageIdAndParcelKey(villageId, "12/A||");
        verify(audit).record(eq("CREATE"), eq("LandParcel"), any(), anyString());
    }

    @Test
    void create_withoutGatAndSurvey_isRejected() {
        stubVillage();

        assertThatThrownBy(() -> service.create(request(" ", null), officer)).isInstanceOf(InvalidRequestException.class);
        verify(parcels, never()).saveAndFlush(any());
    }

    @Test
    void create_unknownVillage_isRejected() {
        when(lookup.findActiveVillageDetail(villageId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request("1", null), officer)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void create_districtOutsideTheScope_isForbidden() {
        stubVillage();
        doThrow(new AccessDeniedException("no")).when(geoScope).requireDistrictAccess(officer, districtId);

        assertThatThrownBy(() -> service.create(request("1", null), officer)).isInstanceOf(AccessDeniedException.class);
        verify(parcels, never()).saveAndFlush(any());
    }

    @Test
    void create_duplicateNumber_isAConflict() {
        stubVillage();
        when(parcels.existsByVillageIdAndParcelKey(villageId, "1|5|")).thenReturn(true);

        assertThatThrownBy(() -> service.create(request("1", "5"), officer)).isInstanceOf(DuplicateResourceException.class);
        verify(parcels, never()).saveAndFlush(any());
    }

    @Test
    void update_toAnotherVillage_isRejected() {
        stored(ParcelStatus.ACTIVE);
        ParcelRequest elsewhere = new ParcelRequest(UUID.randomUUID(), "1", null, null, new BigDecimal("1"),
                LandClassification.FOREST, LandUse.VACANT);

        assertThatThrownBy(() -> service.update(parcelId, elsewhere, officer)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void update_inactiveParcel_isAConflict() {
        stored(ParcelStatus.INACTIVE);

        assertThatThrownBy(() -> service.update(parcelId, request("1", null), officer))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void get_parcelOutsideTheCallersView_isNotFound() {
        stored(ParcelStatus.ACTIVE);
        when(access.canView(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service.get(parcelId, officer)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deactivate_setsTheStatus_andAudits() {
        stored(ParcelStatus.ACTIVE);

        ParcelResponse response = service.setStatus(parcelId, ParcelStatus.INACTIVE, officer);

        assertThat(response.status()).isEqualTo(ParcelStatus.INACTIVE);
        verify(audit).record(eq("DEACTIVATE"), eq("LandParcel"), any(), anyString());
    }
}