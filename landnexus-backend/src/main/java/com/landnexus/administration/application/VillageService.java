package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.VillageRequest;
import com.landnexus.administration.api.dto.VillageResponse;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.Taluka;
import com.landnexus.administration.domain.Village;
import com.landnexus.administration.infrastructure.TalukaRepository;
import com.landnexus.administration.infrastructure.VillageRepository;
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
public class VillageService {

    private final VillageRepository repository;
    private final TalukaRepository talukas;
    private final AuditService audit;

    public VillageService(VillageRepository repository, TalukaRepository talukas, AuditService audit) {
        this.repository = repository;
        this.talukas = talukas;
        this.audit = audit;
    }

    public PageResponse<VillageResponse> list(UUID talukaId, int page, int size) {
        Pageable pageable = PageParams.of(page, size);
        Page<Village> result = talukaId == null
                ? repository.findAll(pageable)
                : repository.findByTaluka_Id(talukaId, pageable);
        return PageResponse.from(result, VillageResponse::from);
    }

    public VillageResponse get(UUID id) {
        return VillageResponse.from(find(id));
    }

    @Transactional
    public VillageResponse create(VillageRequest request) {
        Taluka taluka = requireTaluka(request.talukaId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByTaluka_IdAndCode(taluka.getId(), code)) {
            throw new DuplicateResourceException("Village code already exists in the selected taluka: " + code);
        }
        Village entity = new Village();
        apply(entity, request, code, taluka);
        Village saved = repository.saveAndFlush(entity);
        audit.record("CREATE", "Village", saved.getId(), describe(saved));
        return VillageResponse.from(saved);
    }

    @Transactional
    public VillageResponse update(UUID id, VillageRequest request) {
        Village entity = find(id);
        Taluka taluka = requireTaluka(request.talukaId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByTaluka_IdAndCodeAndIdNot(taluka.getId(), code, id)) {
            throw new DuplicateResourceException("Village code already exists in the selected taluka: " + code);
        }
        String before = describe(entity);
        apply(entity, request, code, taluka);
        Village saved = repository.saveAndFlush(entity);
        audit.record("UPDATE", "Village", saved.getId(), "before: " + before + " | after: " + describe(saved));
        return VillageResponse.from(saved);
    }

    @Transactional
    public VillageResponse setStatus(UUID id, RecordStatus status) {
        Village entity = find(id);
        entity.setStatus(status);
        Village saved = repository.saveAndFlush(entity);
        audit.record(status == RecordStatus.ACTIVE ? "ACTIVATE" : "DEACTIVATE", "Village", saved.getId(), describe(saved));
        return VillageResponse.from(saved);
    }

    private void apply(Village entity, VillageRequest request, String code, Taluka taluka) {
        entity.setCode(code);
        entity.setName(TextNormalizer.name(request.name()));
        entity.setTaluka(taluka);
    }

    private static String describe(Village e) {
        return "code=" + e.getCode() + ", name=" + e.getName() + ", status=" + e.getStatus() + ", talukaId=" + (e.getTaluka() == null ? null : e.getTaluka().getId());
    }

    private Village find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Village not found: " + id));
    }

    private Taluka requireTaluka(UUID id) {
        return talukas.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Taluka not found: " + id));
    }
}
