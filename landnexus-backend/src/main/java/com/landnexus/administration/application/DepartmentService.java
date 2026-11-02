package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.DepartmentRequest;
import com.landnexus.administration.api.dto.DepartmentResponse;
import com.landnexus.administration.domain.Department;
import com.landnexus.administration.domain.Ministry;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.infrastructure.DepartmentRepository;
import com.landnexus.administration.infrastructure.MinistryRepository;
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
public class DepartmentService {

    private final DepartmentRepository repository;
    private final MinistryRepository ministries;
    private final AuditService audit;

    public DepartmentService(DepartmentRepository repository, MinistryRepository ministries, AuditService audit) {
        this.repository = repository;
        this.ministries = ministries;
        this.audit = audit;
    }

    public PageResponse<DepartmentResponse> list(UUID ministryId, int page, int size) {
        Pageable pageable = PageParams.of(page, size);
        Page<Department> result = ministryId == null
                ? repository.findAll(pageable)
                : repository.findByMinistry_Id(ministryId, pageable);
        return PageResponse.from(result, DepartmentResponse::from);
    }

    public DepartmentResponse get(UUID id) {
        return DepartmentResponse.from(find(id));
    }

    @Transactional
    public DepartmentResponse create(DepartmentRequest request) {
        Ministry ministry = requireMinistry(request.ministryId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByCode(code)) {
            throw new DuplicateResourceException("Department code already exists: " + code);
        }
        Department entity = new Department();
        apply(entity, request, code, ministry);
        Department saved = repository.saveAndFlush(entity);
        audit.record("CREATE", "Department", saved.getId(), describe(saved));
        return DepartmentResponse.from(saved);
    }

    @Transactional
    public DepartmentResponse update(UUID id, DepartmentRequest request) {
        Department entity = find(id);
        Ministry ministry = requireMinistry(request.ministryId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByCodeAndIdNot(code, id)) {
            throw new DuplicateResourceException("Department code already exists: " + code);
        }
        String before = describe(entity);
        apply(entity, request, code, ministry);
        Department saved = repository.saveAndFlush(entity);
        audit.record("UPDATE", "Department", saved.getId(), "before: " + before + " | after: " + describe(saved));
        return DepartmentResponse.from(saved);
    }

    @Transactional
    public DepartmentResponse setStatus(UUID id, RecordStatus status) {
        Department entity = find(id);
        entity.setStatus(status);
        Department saved = repository.saveAndFlush(entity);
        audit.record(status == RecordStatus.ACTIVE ? "ACTIVATE" : "DEACTIVATE", "Department", saved.getId(), describe(saved));
        return DepartmentResponse.from(saved);
    }

    private void apply(Department entity, DepartmentRequest request, String code, Ministry ministry) {
        entity.setCode(code);
        entity.setName(TextNormalizer.name(request.name()));
        entity.setMinistry(ministry);
        entity.setLevel(request.level());
    }

    private static String describe(Department e) {
        return "code=" + e.getCode() + ", name=" + e.getName() + ", status=" + e.getStatus() + ", ministryId=" + (e.getMinistry() == null ? null : e.getMinistry().getId()) + ", level=" + e.getLevel();
    }

    private Department find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found: " + id));
    }

    private Ministry requireMinistry(UUID id) {
        return ministries.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ministry not found: " + id));
    }
}
