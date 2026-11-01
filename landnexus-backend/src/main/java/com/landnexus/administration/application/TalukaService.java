package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.TalukaRequest;
import com.landnexus.administration.api.dto.TalukaResponse;
import com.landnexus.administration.domain.District;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.Taluka;
import com.landnexus.administration.infrastructure.DistrictRepository;
import com.landnexus.administration.infrastructure.TalukaRepository;
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
public class TalukaService {

    private final TalukaRepository repository;
    private final DistrictRepository districts;

    public TalukaService(TalukaRepository repository, DistrictRepository districts) {
        this.repository = repository;
        this.districts = districts;
    }

    public PageResponse<TalukaResponse> list(UUID districtId, int page, int size) {
        Pageable pageable = PageParams.of(page, size);
        Page<Taluka> result = districtId == null
                ? repository.findAll(pageable)
                : repository.findByDistrict_Id(districtId, pageable);
        return PageResponse.from(result, TalukaResponse::from);
    }

    public TalukaResponse get(UUID id) {
        return TalukaResponse.from(find(id));
    }

    @Transactional
    public TalukaResponse create(TalukaRequest request) {
        District district = requireDistrict(request.districtId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByDistrict_IdAndCode(district.getId(), code)) {
            throw new DuplicateResourceException("Taluka code already exists in the selected district: " + code);
        }
        Taluka entity = new Taluka();
        apply(entity, request, code, district);
        return TalukaResponse.from(repository.saveAndFlush(entity));
    }

    @Transactional
    public TalukaResponse update(UUID id, TalukaRequest request) {
        Taluka entity = find(id);
        District district = requireDistrict(request.districtId());
        String code = TextNormalizer.code(request.code());
        if (repository.existsByDistrict_IdAndCodeAndIdNot(district.getId(), code, id)) {
            throw new DuplicateResourceException("Taluka code already exists in the selected district: " + code);
        }
        apply(entity, request, code, district);
        return TalukaResponse.from(repository.saveAndFlush(entity));
    }

    @Transactional
    public TalukaResponse setStatus(UUID id, RecordStatus status) {
        Taluka entity = find(id);
        entity.setStatus(status);
        return TalukaResponse.from(repository.saveAndFlush(entity));
    }

    private void apply(Taluka entity, TalukaRequest request, String code, District district) {
        entity.setCode(code);
        entity.setName(TextNormalizer.name(request.name()));
        entity.setDistrict(district);
    }

    private Taluka find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Taluka not found: " + id));
    }

    private District requireDistrict(UUID id) {
        return districts.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("District not found: " + id));
    }
}
