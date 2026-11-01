package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.DistrictRequest;
import com.landnexus.administration.api.dto.DistrictResponse;
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
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.validation.TextNormalizer;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DistrictService {

    private final DistrictRepository repository;
    private final StateRepository states;
    private final DivisionRepository divisions;

    public DistrictService(DistrictRepository repository, StateRepository states, DivisionRepository divisions) {
        this.repository = repository;
        this.states = states;
        this.divisions = divisions;
    }

    public PageResponse<DistrictResponse> list(UUID stateId, int page, int size) {
        Pageable pageable = PageParams.of(page, size);
        Page<District> result = stateId == null
                ? repository.findAll(pageable)
                : repository.findByState_Id(stateId, pageable);
        return PageResponse.from(result, DistrictResponse::from);
    }

    public DistrictResponse get(UUID id) {
        return DistrictResponse.from(find(id));
    }

    @Transactional
    public DistrictResponse create(DistrictRequest request) {
        State state = requireState(request.stateId());
        Division division = request.divisionId() == null
                ? null
                : requireDivision(request.divisionId());
        if (division != null && !division.getState().getId().equals(state.getId())) {
            throw new InvalidRequestException("The selected division does not belong to the selected state");
        }
        String code = TextNormalizer.code(request.code());
        if (repository.existsByState_IdAndCode(state.getId(), code)) {
            throw new DuplicateResourceException("District code already exists in the selected state: " + code);
        }
        District entity = new District();
        apply(entity, request, code, state, division);
        return DistrictResponse.from(repository.saveAndFlush(entity));
    }

    @Transactional
    public DistrictResponse update(UUID id, DistrictRequest request) {
        District entity = find(id);
        State state = requireState(request.stateId());
        Division division = request.divisionId() == null
                ? null
                : requireDivision(request.divisionId());
        if (division != null && !division.getState().getId().equals(state.getId())) {
            throw new InvalidRequestException("The selected division does not belong to the selected state");
        }
        String code = TextNormalizer.code(request.code());
        if (repository.existsByState_IdAndCodeAndIdNot(state.getId(), code, id)) {
            throw new DuplicateResourceException("District code already exists in the selected state: " + code);
        }
        apply(entity, request, code, state, division);
        return DistrictResponse.from(repository.saveAndFlush(entity));
    }

    @Transactional
    public DistrictResponse setStatus(UUID id, RecordStatus status) {
        District entity = find(id);
        entity.setStatus(status);
        return DistrictResponse.from(repository.saveAndFlush(entity));
    }

    private void apply(District entity, DistrictRequest request, String code, State state, Division division) {
        entity.setCode(code);
        entity.setName(TextNormalizer.name(request.name()));
        entity.setState(state);
        entity.setDivision(division);
    }

    private District find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("District not found: " + id));
    }

    private State requireState(UUID id) {
        return states.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("State not found: " + id));
    }

    private Division requireDivision(UUID id) {
        return divisions.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Division not found: " + id));
    }
}
