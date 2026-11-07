package com.landnexus.compensation.application;

import com.landnexus.acquisition.application.AcquisitionLookupService;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.compensation.api.dto.CompensationDtos.ComponentRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.ComponentResponse;
import com.landnexus.compensation.api.dto.CompensationDtos.RuleSetRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.RuleSetResponse;
import com.landnexus.compensation.domain.CompTypes.ComponentType;
import com.landnexus.compensation.domain.CompTypes.RuleSetStatus;
import com.landnexus.compensation.domain.RuleSet;
import com.landnexus.compensation.domain.RuleSetComponent;
import com.landnexus.compensation.infrastructure.RuleSetComponentRepository;
import com.landnexus.compensation.infrastructure.RuleSetRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Versioned compensation rule sets. The law is NOT built in: authorised staff enter the components, a second person
 * approves them, and the engine applies exactly that. The most specific approved set wins (district, then state,
 * then nationwide) among those valid on the reference date for the case's legal framework.
 */
@Service
@Transactional(readOnly = true)
public class RuleSetService {

    public record Selected(RuleSet ruleSet, List<RuleSetComponent> components) {
    }

    private static final String ENTITY = "RuleSet";
    private static final BigDecimal MAX_MULTIPLIER = new BigDecimal("10");
    private static final BigDecimal MAX_PERCENT = new BigDecimal("500");
    private static final BigDecimal MAX_PER_HECTARE = new BigDecimal("1000000000");

    private final RuleSetRepository ruleSets;
    private final RuleSetComponentRepository components;
    private final AcquisitionLookupService acquisition;
    private final AdministrationLookupService admin;
    private final AuditService audit;
    private final Clock clock;

    public RuleSetService(RuleSetRepository ruleSets, RuleSetComponentRepository components,
                          AcquisitionLookupService acquisition, AdministrationLookupService admin,
                          AuditService audit, Clock clock) {
        this.ruleSets = ruleSets;
        this.components = components;
        this.acquisition = acquisition;
        this.admin = admin;
        this.audit = audit;
        this.clock = clock;
    }

    public PageResponse<RuleSetResponse> list(RuleSetStatus status, int page, int size) {
        Pageable pageable = PageParams.ofDescending(page, size, "createdAt");
        Page<RuleSet> result = status == null ? ruleSets.findAll(pageable) : ruleSets.findByStatus(status, pageable);
        return PageResponse.from(result, rs -> toResponse(rs, components.findByRuleSetIdOrderByPositionAsc(rs.getId())));
    }

    public RuleSetResponse get(UUID id) {
        RuleSet rs = ruleSets.findById(id).orElseThrow(() -> new ResourceNotFoundException("Rule set not found: " + id));
        return toResponse(rs, components.findByRuleSetIdOrderByPositionAsc(id));
    }

    @Transactional
    public RuleSetResponse create(RuleSetRequest r, CurrentActor actor) {
        String framework = r.framework().trim().toUpperCase(Locale.ROOT);
        if (!acquisition.frameworks().contains(framework)) {
            throw new InvalidRequestException("Unknown legal framework: " + framework);
        }
        if (r.districtId() != null && admin.findActiveDistrict(r.districtId()).isEmpty()) {
            throw new InvalidRequestException("Unknown or inactive district: " + r.districtId());
        }
        if (r.effectiveTo() != null && r.effectiveTo().isBefore(r.effectiveFrom())) {
            throw new InvalidRequestException("The end date cannot be before the start date");
        }
        validateComponents(r.components());

        String name = r.name().trim();
        RuleSet saved = ruleSets.saveAndFlush(new RuleSet(name, ruleSets.maxVersion(name) + 1, framework, r.stateId(),
                r.districtId(), r.effectiveFrom(), r.effectiveTo(), blankToNull(r.description()), actor.userId()));
        List<RuleSetComponent> rows = new ArrayList<>();
        int position = 1;
        for (ComponentRequest c : r.components()) {
            BigDecimal factor = c.type() == ComponentType.ASSET_VALUE ? BigDecimal.ONE : c.factor();
            rows.add(components.save(new RuleSetComponent(saved.getId(), position++, c.code(), c.name().trim(), c.type(),
                    factor, c.baseCodes())));
        }
        audit.record("CREATE", ENTITY, saved.getId(), "name=" + name + ", version=" + saved.getVersion()
                + ", framework=" + framework + ", components=" + rows.size());
        return toResponse(saved, rows);
    }

    /** The approver must be a different person than the drafter, and the set must not overlap another approved one. */
    @Transactional
    public RuleSetResponse approve(UUID id, CurrentActor actor) {
        RuleSet rs = ruleSets.findById(id).orElseThrow(() -> new ResourceNotFoundException("Rule set not found: " + id));
        if (rs.getStatus() != RuleSetStatus.DRAFT) {
            throw new InvalidTransitionException("Only a draft rule set can be approved");
        }
        if (actor.userId().equals(rs.getCreatedByUserId())) {
            throw new AccessDeniedException("The person who drafted a rule set cannot approve it");
        }
        for (RuleSet other : ruleSets.findByStatusAndFramework(RuleSetStatus.APPROVED, rs.getFramework())) {
            if (Objects.equals(other.getStateId(), rs.getStateId()) && Objects.equals(other.getDistrictId(), rs.getDistrictId())
                    && overlaps(other, rs)) {
                throw new InvalidTransitionException("It overlaps the approved rule set " + other.getName() + " v"
                        + other.getVersion() + " for the same place: retire it or adjust the dates");
            }
        }
        rs.approve(actor.userId(), clock.instant());
        RuleSet saved = ruleSets.saveAndFlush(rs);
        audit.record("APPROVE", ENTITY, id, "name=" + rs.getName() + ", version=" + rs.getVersion());
        return toResponse(saved, components.findByRuleSetIdOrderByPositionAsc(id));
    }

    @Transactional
    public RuleSetResponse retire(UUID id, String reason, CurrentActor actor) {
        String why = blankToNull(reason);
        if (why == null) {
            throw new InvalidRequestException("A reason is required to retire a rule set");
        }
        RuleSet rs = ruleSets.findById(id).orElseThrow(() -> new ResourceNotFoundException("Rule set not found: " + id));
        if (rs.getStatus() == RuleSetStatus.RETIRED) {
            throw new InvalidTransitionException("The rule set is already retired");
        }
        rs.retire(why);
        RuleSet saved = ruleSets.saveAndFlush(rs);
        audit.record("RETIRE", ENTITY, id, "name=" + rs.getName() + ", version=" + rs.getVersion() + ", reason=" + why);
        return toResponse(saved, components.findByRuleSetIdOrderByPositionAsc(id));
    }

    /** District beats state beats nationwide; then the latest start date. Several finalists is an error, never a guess. */
    public Selected selectFor(UUID stateId, UUID districtId, String framework, LocalDate referenceDate) {
        List<RuleSet> candidates = ruleSets.findByStatusAndFramework(RuleSetStatus.APPROVED, framework).stream()
                .filter(rs -> !referenceDate.isBefore(rs.getEffectiveFrom())
                        && (rs.getEffectiveTo() == null || !referenceDate.isAfter(rs.getEffectiveTo())))
                .filter(rs -> specificity(rs, stateId, districtId) > 0)
                .toList();
        if (candidates.isEmpty()) {
            throw new InvalidRequestException("No approved rule set applies to framework " + framework + " on " + referenceDate);
        }
        int best = candidates.stream().mapToInt(rs -> specificity(rs, stateId, districtId)).max().orElseThrow();
        List<RuleSet> top = candidates.stream().filter(rs -> specificity(rs, stateId, districtId) == best).toList();
        LocalDate latest = top.stream().map(RuleSet::getEffectiveFrom).max(Comparator.naturalOrder()).orElseThrow();
        List<RuleSet> finalists = top.stream().filter(rs -> rs.getEffectiveFrom().equals(latest)).toList();
        if (finalists.size() > 1) {
            throw new InvalidRequestException("More than one rule set applies; retire the duplicates");
        }
        RuleSet chosen = finalists.get(0);
        return new Selected(chosen, components.findByRuleSetIdOrderByPositionAsc(chosen.getId()));
    }

    private static int specificity(RuleSet rs, UUID stateId, UUID districtId) {
        if (rs.getDistrictId() != null) {
            return rs.getDistrictId().equals(districtId) ? 3 : 0;
        }
        if (rs.getStateId() != null) {
            return rs.getStateId().equals(stateId) ? 2 : 0;
        }
        return 1;
    }

    private static boolean overlaps(RuleSet a, RuleSet b) {
        boolean aStartsBeforeBEnds = b.getEffectiveTo() == null || !a.getEffectiveFrom().isAfter(b.getEffectiveTo());
        boolean bStartsBeforeAEnds = a.getEffectiveTo() == null || !b.getEffectiveFrom().isAfter(a.getEffectiveTo());
        return aStartsBeforeBEnds && bStartsBeforeAEnds;
    }

    private static void validateComponents(List<ComponentRequest> list) {
        Set<String> earlier = new HashSet<>();
        int land = 0;
        int asset = 0;
        for (ComponentRequest c : list) {
            if (earlier.contains(c.code())) {
                throw new InvalidRequestException("Duplicate component code: " + c.code());
            }
            BigDecimal f = c.factor();
            switch (c.type()) {
                case LAND_VALUE -> {
                    land++;
                    if (f == null || f.signum() <= 0 || f.compareTo(MAX_MULTIPLIER) > 0) {
                        throw new InvalidRequestException(c.code() + ": the multiplier must be above 0 and at most 10");
                    }
                }
                case ASSET_VALUE -> asset++;
                case PERCENT_OF -> {
                    if (f == null || f.signum() < 0 || f.compareTo(MAX_PERCENT) > 0) {
                        throw new InvalidRequestException(c.code() + ": the percentage must be between 0 and 500");
                    }
                    if (c.baseCodes() == null || c.baseCodes().isEmpty()) {
                        throw new InvalidRequestException(c.code() + ": baseCodes are required for PERCENT_OF");
                    }
                    for (String base : c.baseCodes()) {
                        if (!earlier.contains(base)) {
                            throw new InvalidRequestException(c.code() + ": " + base + " must be an EARLIER component");
                        }
                    }
                }
                case FIXED_PER_HECTARE -> {
                    if (f == null || f.signum() < 0 || f.compareTo(MAX_PER_HECTARE) > 0) {
                        throw new InvalidRequestException(c.code() + ": the amount per hectare is out of range");
                    }
                }
            }
            earlier.add(c.code());
        }
        if (land != 1) {
            throw new InvalidRequestException("A rule set needs exactly one LAND_VALUE component");
        }
        if (asset > 1) {
            throw new InvalidRequestException("A rule set can have at most one ASSET_VALUE component");
        }
    }

    private static RuleSetResponse toResponse(RuleSet rs, List<RuleSetComponent> rows) {
        return new RuleSetResponse(rs.getId(), rs.getName(), rs.getVersion(), rs.getFramework(), rs.getStateId(),
                rs.getDistrictId(), rs.getEffectiveFrom(), rs.getEffectiveTo(), rs.getDescription(), rs.getStatus(),
                rs.getCreatedByUserId(), rs.getApprovedByUserId(), rs.getApprovedAt(), rs.getRetireReason(),
                rows.stream().map(c -> new ComponentResponse(c.getPosition(), c.getCode(), c.getName(), c.getType(),
                        c.getFactor(), c.baseCodeList())).toList());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}