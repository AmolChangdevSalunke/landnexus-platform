package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.DistrictRequest;
import com.landnexus.administration.api.dto.DistrictResponse;
import com.landnexus.administration.application.DistrictService;
import com.landnexus.administration.domain.District;
import com.landnexus.administration.domain.Division;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.State;
import com.landnexus.administration.infrastructure.DistrictRepository;
import com.landnexus.administration.infrastructure.DivisionRepository;
import com.landnexus.administration.infrastructure.StateRepository;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
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
class DistrictServiceTest {

    @Mock private DistrictRepository repository;
    @Mock private StateRepository states;
    @Mock private DivisionRepository divisions;

    @InjectMocks
    private DistrictService service;

    @Test
    void create_normalizesCodeAndName_andStoresActiveRecord() {
        UUID stateId = UUID.randomUUID();
        when(states.findById(stateId)).thenReturn(Optional.of(withId(new State(), stateId)));
        when(repository.existsByState_IdAndCode(stateId, "ABC")).thenReturn(false);
        when(repository.saveAndFlush(any(District.class))).thenAnswer(inv -> inv.getArgument(0));

        DistrictResponse response = service.create(new DistrictRequest("  abc ", "  Sample   Name ", stateId, null));

        assertThat(response.code()).isEqualTo("ABC");
        assertThat(response.name()).isEqualTo("Sample Name");
        assertThat(response.status()).isEqualTo(RecordStatus.ACTIVE);
        assertThat(response.stateId()).isEqualTo(stateId);
    }

    @Test
    void create_duplicateCode_throwsConflict_andDoesNotSave() {
        UUID stateId = UUID.randomUUID();
        when(states.findById(stateId)).thenReturn(Optional.of(withId(new State(), stateId)));
        when(repository.existsByState_IdAndCode(stateId, "ABC")).thenReturn(true);

        assertThatThrownBy(() -> service.create(new DistrictRequest("  abc ", "  Sample   Name ", stateId, null)))
                .isInstanceOf(DuplicateResourceException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void create_unknownState_throwsNotFound() {
        UUID stateId = UUID.randomUUID();
        when(states.findById(stateId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(new DistrictRequest("  abc ", "  Sample   Name ", stateId, null)))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void create_divisionFromAnotherState_throwsInvalidRequest() {
        UUID stateId = UUID.randomUUID();
        UUID divisionId = UUID.randomUUID();
        Division division = withId(new Division(), divisionId);
        division.setState(withId(new State(), UUID.randomUUID()));
        when(states.findById(stateId)).thenReturn(Optional.of(withId(new State(), stateId)));
        when(divisions.findById(divisionId)).thenReturn(Optional.of(division));

        assertThatThrownBy(() -> service.create(new DistrictRequest("abc", "Name", stateId, divisionId)))
                .isInstanceOf(InvalidRequestException.class);
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
        District existing = withId(new District(), id);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.saveAndFlush(existing)).thenReturn(existing);

        DistrictResponse response = service.setStatus(id, RecordStatus.INACTIVE);

        assertThat(response.status()).isEqualTo(RecordStatus.INACTIVE);
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
