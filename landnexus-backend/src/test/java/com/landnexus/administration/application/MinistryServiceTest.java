package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.MinistryRequest;
import com.landnexus.administration.api.dto.MinistryResponse;
import com.landnexus.administration.application.MinistryService;
import com.landnexus.administration.domain.Ministry;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.infrastructure.MinistryRepository;
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
class MinistryServiceTest {

    @Mock private MinistryRepository repository;

    @InjectMocks
    private MinistryService service;

    @Test
    void create_normalizesCodeAndName_andStoresActiveRecord() {
        when(repository.existsByCode("ABC")).thenReturn(false);
        when(repository.saveAndFlush(any(Ministry.class))).thenAnswer(inv -> inv.getArgument(0));

        MinistryResponse response = service.create(new MinistryRequest("  abc ", "  Sample   Name "));

        assertThat(response.code()).isEqualTo("ABC");
        assertThat(response.name()).isEqualTo("Sample Name");
        assertThat(response.status()).isEqualTo(RecordStatus.ACTIVE);
    }

    @Test
    void create_duplicateCode_throwsConflict_andDoesNotSave() {
        when(repository.existsByCode("ABC")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new MinistryRequest("  abc ", "  Sample   Name ")))
                .isInstanceOf(DuplicateResourceException.class);
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
        Ministry existing = withId(new Ministry(), id);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        MinistryResponse response = service.setStatus(id, RecordStatus.INACTIVE);

        assertThat(response.status()).isEqualTo(RecordStatus.INACTIVE);
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
