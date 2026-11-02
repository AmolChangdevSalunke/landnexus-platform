package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.DivisionRequest;
import com.landnexus.administration.api.dto.DivisionResponse;
import com.landnexus.administration.domain.Division;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.State;
import com.landnexus.administration.infrastructure.DivisionRepository;
import com.landnexus.administration.infrastructure.StateRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
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
public class DivisionService {

    private final DivisionRepository repository;
    private final StateRepository states;
    private final AuditService audit;

    public DivisionService(DivisionRepository repository, StateRepository states, AuditService audit) {
        this.repository = repository;
        this.states = states;
        this.audit = audit;
    }

    public PageResponse<DivisionResponse> list(UUID stateId, int page, int size) {
        Pageable pageable = PageParams.of(page, size);
        Page<Division> result = stateId == null
                ? repository.findAll(pageable)
                : repository.findByState_Id(stateId, pageable);
        return PageResponse.from(result, DivisionResponse::from);
    }

    public DivisionResponse get(UUID id) {
        return DivisionResponse.from(find(id));
    }

    @Transactional
    public DivisionResponse create(DivisionRequest request) {
        State state = requireState(request.stateId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByState_IdAndCode(state.getId(), code)) {
            throw new DuplicateResourceException("Division code already exists in the selected state: " + code);
        }
        Division entity = new Division();
        apply(entity, request, code, state);
        Division saved = repository.saveAndFlush(entity);
        audit.record("CREATE", "Division", saved.getId(), describe(saved));
        return DivisionResponse.from(saved);
    }

    @Transactional
    public DivisionResponse update(UUID id, DivisionRequest request) {
        Division entity = find(id);
        State state = requireState(request.stateId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByState_IdAndCodeAndIdNot(state.getId(), code, id)) {
            throw new DuplicateResourceException("Division code already exists in the selected state: " + code);
        }
        String before = describe(entity);
        apply(entity, request, code, state);
        Division saved = repository.saveAndFlush(entity);
        audit.record("UPDATE", "Division", saved.getId(), "before: " + before + " | after: " + describe(saved));
        return DivisionResponse.from(saved);
    }

    @Transactional
    public DivisionResponse setStatus(UUID id, RecordStatus status) {
        Division entity = find(id);
        entity.setStatus(status);
        Division saved = repository.saveAndFlush(entity);
        audit.record(status == RecordStatus.ACTIVE ? "ACTIVATE" : "DEACTIVATE", "Division", saved.getId(), describe(saved));
        return DivisionResponse.from(saved);
    }

    private void apply(Division entity, DivisionRequest request, String code, State state) {
        entity.setCode(code);
        entity.setName(TextNormalizer.name(request.name()));
        entity.setState(state);
    }

    private static String describe(Division e) {
        return "code=" + e.getCode() + ", name=" + e.getName() + ", status=" + e.getStatus() + ", stateId=" + (e.getState() == null ? null : e.getState().getId());
    }

    private Division find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Division not found: " + id));
    }

    private State requireState(UUID id) {
        return states.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("State not found: " + id));
    }
}
