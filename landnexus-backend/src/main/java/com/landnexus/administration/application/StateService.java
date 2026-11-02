package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.StateRequest;
import com.landnexus.administration.api.dto.StateResponse;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.State;
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
public class StateService {

    private final StateRepository repository;
    private final AuditService audit;

    public StateService(StateRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    public PageResponse<StateResponse> list(int page, int size) {
        Pageable pageable = PageParams.of(page, size);
        Page<State> result = repository.findAll(pageable);
        return PageResponse.from(result, StateResponse::from);
    }

    public StateResponse get(UUID id) {
        return StateResponse.from(find(id));
    }

    @Transactional
    public StateResponse create(StateRequest request) {
        String code = TextNormalizer.code(request.code());
        if (repository.existsByCode(code)) {
            throw new DuplicateResourceException("State code already exists: " + code);
        }
        State entity = new State();
        apply(entity, request, code);
        State saved = repository.saveAndFlush(entity);
        audit.record("CREATE", "State", saved.getId(), describe(saved));
        return StateResponse.from(saved);
    }

    @Transactional
    public StateResponse update(UUID id, StateRequest request) {
        State entity = find(id);
        String code = TextNormalizer.code(request.code());
        if (repository.existsByCodeAndIdNot(code, id)) {
            throw new DuplicateResourceException("State code already exists: " + code);
        }
        String before = describe(entity);
        apply(entity, request, code);
        State saved = repository.saveAndFlush(entity);
        audit.record("UPDATE", "State", saved.getId(), "before: " + before + " | after: " + describe(saved));
        return StateResponse.from(saved);
    }

    @Transactional
    public StateResponse setStatus(UUID id, RecordStatus status) {
        State entity = find(id);
        entity.setStatus(status);
        State saved = repository.saveAndFlush(entity);
        audit.record(status == RecordStatus.ACTIVE ? "ACTIVATE" : "DEACTIVATE", "State", saved.getId(), describe(saved));
        return StateResponse.from(saved);
    }

    private void apply(State entity, StateRequest request, String code) {
        entity.setCode(code);
        entity.setName(TextNormalizer.name(request.name()));
    }

    private static String describe(State e) {
        return "code=" + e.getCode() + ", name=" + e.getName() + ", status=" + e.getStatus();
    }

    private State find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("State not found: " + id));
    }
}
