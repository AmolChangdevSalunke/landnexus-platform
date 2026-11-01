package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.MinistryRequest;
import com.landnexus.administration.api.dto.MinistryResponse;
import com.landnexus.administration.domain.Ministry;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.infrastructure.MinistryRepository;
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
public class MinistryService {

    private final MinistryRepository repository;

    public MinistryService(MinistryRepository repository) {
        this.repository = repository;
    }

    public PageResponse<MinistryResponse> list(int page, int size) {
        Pageable pageable = PageParams.of(page, size);
        Page<Ministry> result = repository.findAll(pageable);
        return PageResponse.from(result, MinistryResponse::from);
    }

    public MinistryResponse get(UUID id) {
        return MinistryResponse.from(find(id));
    }

    @Transactional
    public MinistryResponse create(MinistryRequest request) {
        String code = TextNormalizer.code(request.code());
        if (repository.existsByCode(code)) {
            throw new DuplicateResourceException("Ministry code already exists: " + code);
        }
        Ministry entity = new Ministry();
        apply(entity, request, code);
        return MinistryResponse.from(repository.saveAndFlush(entity));
    }

    @Transactional
    public MinistryResponse update(UUID id, MinistryRequest request) {
        Ministry entity = find(id);
        String code = TextNormalizer.code(request.code());
        if (repository.existsByCodeAndIdNot(code, id)) {
            throw new DuplicateResourceException("Ministry code already exists: " + code);
        }
        apply(entity, request, code);
        return MinistryResponse.from(repository.saveAndFlush(entity));
    }

    @Transactional
    public MinistryResponse setStatus(UUID id, RecordStatus status) {
        Ministry entity = find(id);
        entity.setStatus(status);
        return MinistryResponse.from(repository.saveAndFlush(entity));
    }

    private void apply(Ministry entity, MinistryRequest request, String code) {
        entity.setCode(code);
        entity.setName(TextNormalizer.name(request.name()));
    }

    private Ministry find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ministry not found: " + id));
    }
}
