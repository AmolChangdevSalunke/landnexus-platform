package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.TalukaRequest;
import com.landnexus.administration.api.dto.TalukaResponse;
import com.landnexus.administration.application.TalukaService;
import com.landnexus.administration.domain.District;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.Taluka;
import com.landnexus.administration.infrastructure.DistrictRepository;
import com.landnexus.administration.infrastructure.TalukaRepository;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TalukaServiceTest {

    @Mock private TalukaRepository repository;
    @Mock private DistrictRepository districts;

    @InjectMocks
    private TalukaService service;

    @Test
    void create_normalizesCodeAndName_andStoresActiveRecord() {
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.of(withId(new District(), districtId)));
        when(repository.existsByDistrict_IdAndCode(districtId, "ABC")).thenReturn(false);
        when(repository.saveAndFlush(any(Taluka.class))).thenAnswer(inv -> inv.getArgument(0));

        TalukaResponse response = service.create(new TalukaRequest("  abc ", "  Sample   Name ", districtId));

        assertThat(response.code()).isEqualTo("ABC");
        assertThat(response.name()).isEqualTo("Sample Name");
        assertThat(response.status()).isEqualTo(RecordStatus.ACTIVE);
        assertThat(response.districtId()).isEqualTo(districtId);
    }

    @Test
    void create_duplicateCode_throwsConflict_andDoesNotSave() {
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.of(withId(new District(), districtId)));
        when(repository.existsByDistrict_IdAndCode(districtId, "ABC")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new TalukaRequest("  abc ", "  Sample   Name ", districtId)))
                .isInstanceOf(DuplicateResourceException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void create_unknownDistrict_throwsNotFound() {
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(new TalukaRequest("  abc ", "  Sample   Name ", districtId)))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void get_unknownId_throwsNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deactivate_setsStatusInactive() {
        UUID id = UUID.randomUUID();
        Taluka existing = withId(new Taluka(), id);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        TalukaResponse response = service.setStatus(id, RecordStatus.INACTIVE);

        assertThat(response.status()).isEqualTo(RecordStatus.INACTIVE);
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
