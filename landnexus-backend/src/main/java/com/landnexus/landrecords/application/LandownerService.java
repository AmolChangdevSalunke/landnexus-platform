package com.landnexus.landrecords.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.landrecords.api.dto.LandDtos.LandownerRequest;
import com.landnexus.landrecords.api.dto.LandDtos.LandownerResponse;
import com.landnexus.landrecords.api.dto.LandDtos.LandownerSummary;
import com.landnexus.landrecords.domain.Landowner;
import com.landnexus.landrecords.infrastructure.LandownerRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import com.landnexus.shared.validation.TextNormalizer;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Landowners are sensitive personal data: audit text never contains names, addresses or phones. */
@Service
@Transactional(readOnly = true)
public class LandownerService {

    private static final String ENTITY = "Landowner";

    private final LandownerRepository landowners;
    private final AdministrationLookupService lookup;
    private final GeoScopeService geoScope;
    private final LandAccess access;
    private final AuditService audit;

    public LandownerService(LandownerRepository landowners, AdministrationLookupService lookup,
                            GeoScopeService geoScope, LandAccess access, AuditService audit) {
        this.landowners = landowners;
        this.lookup = lookup;
        this.geoScope = geoScope;
        this.access = access;
        this.audit = audit;
    }

    @Transactional
    public LandownerResponse get(UUID id, CurrentActor actor) {
        Landowner owner = loadVisible(id, actor);
        audit.record("VIEW", ENTITY, owner.getId(), "detail view");
        return LandownerResponse.from(owner);
    }

    @Transactional
    public PageResponse<LandownerSummary> list(UUID districtId, String name, int page, int size, CurrentActor actor) {
        Specification<Landowner> spec = access.visibleTo(actor);
        if (districtId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("districtId"), districtId));
        }
        if (name != null && !name.isBlank()) {
            String pattern = "%" + escapeLike(name.trim().toLowerCase(Locale.ROOT)) + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("fullName")), pattern, '\\'));
        }
        Page<Landowner> result = landowners.findAll(spec, PageParams.of(page, size, "fullName"));
        audit.record("VIEW_LIST", ENTITY, null,
                "page=" + page + ", size=" + size + ", rows=" + result.getNumberOfElements());
        return PageResponse.from(result, LandownerSummary::from);
    }

    @Transactional
    public LandownerResponse create(LandownerRequest request, CurrentActor actor) {
        lookup.findActiveDistrict(request.districtId())
                .orElseThrow(() -> new InvalidRequestException("Unknown or inactive district: " + request.districtId()));
        geoScope.requireDistrictAccess(actor, request.districtId());
        Landowner owner = new Landowner();
        owner.setDistrictId(request.districtId());
        fill(owner, request);
        Landowner saved = landowners.saveAndFlush(owner);
        audit.record("CREATE", ENTITY, saved.getId(),
                "districtId=" + saved.getDistrictId() + ", ownerType=" + saved.getOwnerType());
        return LandownerResponse.from(saved);
    }

    @Transactional
    public LandownerResponse update(UUID id, LandownerRequest request, CurrentActor actor) {
        Landowner owner = loadVisible(id, actor);
        if (!owner.getDistrictId().equals(request.districtId())) {
            throw new InvalidRequestException("A landowner cannot be moved to another district");
        }
        fill(owner, request);
        Landowner saved = landowners.saveAndFlush(owner);
        audit.record("UPDATE", ENTITY, saved.getId(), "personal details changed");
        return LandownerResponse.from(saved);
    }

    private Landowner loadVisible(UUID id, CurrentActor actor) {
        Landowner owner = landowners.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Landowner not found: " + id));
        if (!access.canView(actor, owner.getDistrictId())) {
            throw new ResourceNotFoundException("Landowner not found: " + id);
        }
        return owner;
    }

    private static void fill(Landowner owner, LandownerRequest request) {
        owner.setOwnerType(request.ownerType());
        owner.setFullName(TextNormalizer.name(request.fullName()));
        owner.setGuardianName(blankToNull(request.guardianName()));
        owner.setAddress(blankToNull(request.address()));
        owner.setPhone(blankToNull(request.phone()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : TextNormalizer.name(value);
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}