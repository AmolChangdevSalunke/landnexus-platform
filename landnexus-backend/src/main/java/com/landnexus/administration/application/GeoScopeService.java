package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.DistrictResponse;
import com.landnexus.administration.api.dto.ScopeEntryRequest;
import com.landnexus.administration.api.dto.ScopeEntryResponse;
import com.landnexus.administration.api.dto.UserScopesRequest;
import com.landnexus.administration.domain.District;
import com.landnexus.administration.domain.Division;
import com.landnexus.administration.domain.GeographicScope;
import com.landnexus.administration.domain.State;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.DistrictLookupRepository;
import com.landnexus.administration.infrastructure.DistrictRepository;
import com.landnexus.administration.infrastructure.DivisionRepository;
import com.landnexus.administration.infrastructure.GeographicScopeRepository;
import com.landnexus.administration.infrastructure.StateRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Geographic access control. Later modules (proposals, parcels, surveys) call requireDistrictAccess / resolve
 * before returning or changing district-bound data, so the rule lives in one tested place.
 */
@Service
@Transactional(readOnly = true)
public class GeoScopeService {

    /** Roles that work across the whole country and therefore need no assignment. */
    public static final Set<String> NATIONAL_ROLES = Set.of("SUPER_ADMIN", "CENTRAL_ADMIN", "MINISTRY_ADMIN", "AUDITOR");

    private static final UUID NO_MATCH = new UUID(0L, 0L);

    private final GeographicScopeRepository scopes;
    private final UserAccountRepository users;
    private final StateRepository states;
    private final DivisionRepository divisions;
    private final DistrictRepository districts;
    private final DistrictLookupRepository lookup;
    private final AuditService audit;

    public GeoScopeService(GeographicScopeRepository scopes, UserAccountRepository users, StateRepository states,
                           DivisionRepository divisions, DistrictRepository districts,
                           DistrictLookupRepository lookup, AuditService audit) {
        this.scopes = scopes;
        this.users = users;
        this.states = states;
        this.divisions = divisions;
        this.districts = districts;
        this.lookup = lookup;
        this.audit = audit;
    }

    /** Reads the assignments fresh from the database on every call, so a change takes effect immediately. */
    public GeoScope resolve(CurrentActor actor) {
        if (actor.roles().stream().anyMatch(NATIONAL_ROLES::contains)) {
            return GeoScope.everything();
        }
        Set<UUID> stateIds = new HashSet<>();
        Set<UUID> divisionIds = new HashSet<>();
        Set<UUID> districtIds = new HashSet<>();
        for (GeographicScope scope : scopes.findByUser_Id(actor.userId())) {
            if (scope.getState() != null) {
                stateIds.add(scope.getState().getId());
            } else if (scope.getDivision() != null) {
                divisionIds.add(scope.getDivision().getId());
            } else if (scope.getDistrict() != null) {
                districtIds.add(scope.getDistrict().getId());
            }
        }
        return new GeoScope(false, stateIds, divisionIds, districtIds);
    }

    public boolean canAccessDistrict(CurrentActor actor, UUID districtId) {
        return resolve(actor).allows(findDistrict(districtId));
    }

    /** 404 when the district does not exist, 403 when it exists but is outside the caller's scope. */
    public void requireDistrictAccess(CurrentActor actor, UUID districtId) {
        if (!canAccessDistrict(actor, districtId)) {
            throw new AccessDeniedException("You do not have access to this district");
        }
    }

    public PageResponse<DistrictResponse> accessibleDistricts(CurrentActor actor, int page, int size) {
        GeoScope scope = resolve(actor);
        Pageable pageable = PageParams.of(page, size);
        Page<District> result = scope.nationwide()
                ? districts.findAll(pageable)
                : lookup.findAccessible(nonEmpty(scope.stateIds()), nonEmpty(scope.divisionIds()),
                        nonEmpty(scope.districtIds()), pageable);
        return PageResponse.from(result, DistrictResponse::from);
    }

    /**
     * Ids of every district the caller may work with, or empty when the caller is nationwide
     * (so "empty" means "no restriction", not "nothing").
     */
    public Optional<Set<UUID>> accessibleDistrictIds(CurrentActor actor) {
        GeoScope scope = resolve(actor);
        if (scope.nationwide()) {
            return Optional.empty();
        }
        Page<District> all = lookup.findAccessible(nonEmpty(scope.stateIds()), nonEmpty(scope.divisionIds()),
                nonEmpty(scope.districtIds()), Pageable.unpaged());
        Set<UUID> ids = new HashSet<>();
        for (District district : all) {
            ids.add(district.getId());
        }
        return Optional.of(ids);
    }

    public List<ScopeEntryResponse> listScopes(UUID userId) {
        requireUser(userId);
        return scopes.findByUser_Id(userId).stream().map(ScopeEntryResponse::from).toList();
    }

    @Transactional
    public List<ScopeEntryResponse> replaceScopes(UUID userId, UserScopesRequest request, CurrentActor actor) {
        UserAccount user = requireUser(userId);
        List<GeographicScope> created = new ArrayList<>();
        List<String> summary = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (ScopeEntryRequest entry : request.scopes()) {
            int provided = (entry.stateId() != null ? 1 : 0)
                    + (entry.divisionId() != null ? 1 : 0)
                    + (entry.districtId() != null ? 1 : 0);
            if (provided != 1) {
                throw new InvalidRequestException(
                        "Each scope entry needs exactly one of stateId, divisionId or districtId");
            }
            State state = null;
            Division division = null;
            District district = null;
            String key;
            if (entry.stateId() != null) {
                state = states.findById(entry.stateId())
                        .orElseThrow(() -> new ResourceNotFoundException("State not found: " + entry.stateId()));
                key = "STATE:" + entry.stateId();
            } else if (entry.divisionId() != null) {
                division = divisions.findById(entry.divisionId())
                        .orElseThrow(() -> new ResourceNotFoundException("Division not found: " + entry.divisionId()));
                key = "DIVISION:" + entry.divisionId();
            } else {
                district = districts.findById(entry.districtId())
                        .orElseThrow(() -> new ResourceNotFoundException("District not found: " + entry.districtId()));
                key = "DISTRICT:" + entry.districtId();
            }
            if (seen.add(key)) {
                created.add(new GeographicScope(user, state, division, district, actor.username()));
                summary.add(key);
            }
        }

        scopes.deleteAllForUser(userId);
        List<GeographicScope> saved = scopes.saveAll(created);
        audit.record("REPLACE_SCOPES", "UserAccount", userId,
                "username=" + user.getUsername() + ", scopes=" + summary);
        return saved.stream().map(ScopeEntryResponse::from).toList();
    }

    public boolean stateIsActive(UUID id) {
        return states.findById(id)
                .filter(s -> s.getStatus() == com.landnexus.administration.domain.RecordStatus.ACTIVE).isPresent();
    }

    private District findDistrict(UUID districtId) {
        return districts.findById(districtId)
                .orElseThrow(() -> new ResourceNotFoundException("District not found: " + districtId));
    }

    private UserAccount requireUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    /** An empty IN (...) list is not valid in every database, so an impossible id stands in for "none". */
    private static Set<UUID> nonEmpty(Set<UUID> ids) {
        return ids.isEmpty() ? Set.of(NO_MATCH) : ids;
    }
}
