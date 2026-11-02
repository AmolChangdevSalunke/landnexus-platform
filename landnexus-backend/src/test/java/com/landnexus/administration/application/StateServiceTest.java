package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.StateRequest;
import com.landnexus.administration.api.dto.StateResponse;
import com.landnexus.administration.application.StateService;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.State;
import com.landnexus.administration.infrastructure.StateRepository;
import com.landnexus.shared.audit.AuditService;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StateServiceTest {

    @Mock private StateRepository repository;
    @Mock private AuditService audit;

    @InjectMocks
    private StateService service;

    @Test
    void create_normalizesCodeAndName_andStoresActiveRecord() {
        when(repository.existsByCode("ABC")).thenReturn(false);
        when(repository.saveAndFlush(any(State.class))).thenAnswer(inv -> inv.getArgument(0));

        StateResponse response = service.create(new StateRequest("  abc ", "  Sample   Name "));

        assertThat(response.code()).isEqualTo("ABC");
        assertThat(response.name()).isEqualTo("Sample Name");
        assertThat(response.status()).isEqualTo(RecordStatus.ACTIVE);
        verify(audit).record(eq("CREATE"), eq("State"), any(), anyString());
    }

    @Test
    void create_duplicateCode_throwsConflict_andDoesNotSave() {
        when(repository.existsByCode("ABC")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new StateRequest("  abc ", "  Sample   Name ")))
                .isInstanceOf(DuplicateResourceException.class);
        verify(repository, never()).saveAndFlush(any());
        verify(audit, never()).record(any(), any(), any(), any());
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
        State existing = withId(new State(), id);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        StateResponse response = service.setStatus(id, RecordStatus.INACTIVE);

        assertThat(response.status()).isEqualTo(RecordStatus.INACTIVE);
        verify(audit).record(eq("DEACTIVATE"), eq("State"), any(), anyString());
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
