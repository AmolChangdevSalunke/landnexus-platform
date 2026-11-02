package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.DivisionRequest;
import com.landnexus.administration.api.dto.DivisionResponse;
import com.landnexus.administration.application.DivisionService;
import com.landnexus.administration.domain.Division;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.State;
import com.landnexus.administration.infrastructure.DivisionRepository;
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
class DivisionServiceTest {

    @Mock private DivisionRepository repository;
    @Mock private AuditService audit;
    @Mock private StateRepository states;

    @InjectMocks
    private DivisionService service;

    @Test
    void create_normalizesCodeAndName_andStoresActiveRecord() {
        UUID stateId = UUID.randomUUID();
        when(states.findById(stateId)).thenReturn(Optional.of(withId(new State(), stateId)));
        when(repository.existsByState_IdAndCode(stateId, "ABC")).thenReturn(false);
        when(repository.saveAndFlush(any(Division.class))).thenAnswer(inv -> inv.getArgument(0));

        DivisionResponse response = service.create(new DivisionRequest("  abc ", "  Sample   Name ", stateId));

        assertThat(response.code()).isEqualTo("ABC");
        assertThat(response.name()).isEqualTo("Sample Name");
        assertThat(response.status()).isEqualTo(RecordStatus.ACTIVE);
        assertThat(response.stateId()).isEqualTo(stateId);
        verify(audit).record(eq("CREATE"), eq("Division"), any(), anyString());
    }

    @Test
    void create_duplicateCode_throwsConflict_andDoesNotSave() {
        UUID stateId = UUID.randomUUID();
        when(states.findById(stateId)).thenReturn(Optional.of(withId(new State(), stateId)));
        when(repository.existsByState_IdAndCode(stateId, "ABC")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new DivisionRequest("  abc ", "  Sample   Name ", stateId)))
                .isInstanceOf(DuplicateResourceException.class);
        verify(repository, never()).saveAndFlush(any());
        verify(audit, never()).record(any(), any(), any(), any());
    }

    @Test
    void create_unknownState_throwsNotFound() {
        UUID stateId = UUID.randomUUID();
        when(states.findById(stateId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(new DivisionRequest("  abc ", "  Sample   Name ", stateId)))
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
        Division existing = withId(new Division(), id);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        DivisionResponse response = service.setStatus(id, RecordStatus.INACTIVE);

        assertThat(response.status()).isEqualTo(RecordStatus.INACTIVE);
        verify(audit).record(eq("DEACTIVATE"), eq("Division"), any(), anyString());
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
