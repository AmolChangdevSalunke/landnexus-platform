package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.VillageRequest;
import com.landnexus.administration.api.dto.VillageResponse;
import com.landnexus.administration.application.VillageService;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.Taluka;
import com.landnexus.administration.domain.Village;
import com.landnexus.administration.infrastructure.TalukaRepository;
import com.landnexus.administration.infrastructure.VillageRepository;
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
class VillageServiceTest {

    @Mock private VillageRepository repository;
    @Mock private TalukaRepository talukas;

    @InjectMocks
    private VillageService service;

    @Test
    void create_normalizesCodeAndName_andStoresActiveRecord() {
        UUID talukaId = UUID.randomUUID();
        when(talukas.findById(talukaId)).thenReturn(Optional.of(withId(new Taluka(), talukaId)));
        when(repository.existsByTaluka_IdAndCode(talukaId, "ABC")).thenReturn(false);
        when(repository.saveAndFlush(any(Village.class))).thenAnswer(inv -> inv.getArgument(0));

        VillageResponse response = service.create(new VillageRequest("  abc ", "  Sample   Name ", talukaId));

        assertThat(response.code()).isEqualTo("ABC");
        assertThat(response.name()).isEqualTo("Sample Name");
        assertThat(response.status()).isEqualTo(RecordStatus.ACTIVE);
        assertThat(response.talukaId()).isEqualTo(talukaId);
    }

    @Test
    void create_duplicateCode_throwsConflict_andDoesNotSave() {
        UUID talukaId = UUID.randomUUID();
        when(talukas.findById(talukaId)).thenReturn(Optional.of(withId(new Taluka(), talukaId)));
        when(repository.existsByTaluka_IdAndCode(talukaId, "ABC")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new VillageRequest("  abc ", "  Sample   Name ", talukaId)))
                .isInstanceOf(DuplicateResourceException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void create_unknownTaluka_throwsNotFound() {
        UUID talukaId = UUID.randomUUID();
        when(talukas.findById(talukaId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(new VillageRequest("  abc ", "  Sample   Name ", talukaId)))
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
        Village existing = withId(new Village(), id);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        VillageResponse response = service.setStatus(id, RecordStatus.INACTIVE);

        assertThat(response.status()).isEqualTo(RecordStatus.INACTIVE);
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
