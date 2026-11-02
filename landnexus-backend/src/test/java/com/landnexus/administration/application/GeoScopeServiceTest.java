package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import com.landnexus.shared.security.CurrentActor;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class GeoScopeServiceTest {

    @Mock private GeographicScopeRepository scopes;
    @Mock private UserAccountRepository users;
    @Mock private StateRepository states;
    @Mock private DivisionRepository divisions;
    @Mock private DistrictRepository districts;
    @Mock private DistrictLookupRepository lookup;
    @Mock private AuditService audit;

    private GeoScopeService service;

    private final UUID userId = UUID.randomUUID();
    private final CurrentActor stateAdmin = new CurrentActor(userId, "state-admin", Set.of("STATE_ADMIN"));
    private final CurrentActor centralAdmin = new CurrentActor(UUID.randomUUID(), "central", Set.of("CENTRAL_ADMIN"));

    @BeforeEach
    void setUp() {
        service = new GeoScopeService(scopes, users, states, divisions, districts, lookup, audit);
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }

    private District district(UUID id, State state, Division division) {
        District district = withId(new District(), id);
        district.setState(state);
        district.setDivision(division);
        return district;
    }

    @Test
    void nationalRoles_seeEverything_withoutTouchingAssignments() {
        for (String role : GeoScopeService.NATIONAL_ROLES) {
            CurrentActor actor = new CurrentActor(UUID.randomUUID(), "x", Set.of(role));
            assertThat(service.resolve(actor).nationwide()).isTrue();
        }
        verify(scopes, never()).findByUser_Id(any());
    }

    @Test
    void scopedRole_withoutAssignments_seesNothing() {
        when(scopes.findByUser_Id(userId)).thenReturn(List.of());
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.of(district(districtId, withId(new State(), UUID.randomUUID()), null)));

        assertThat(service.canAccessDistrict(stateAdmin, districtId)).isFalse();
    }

    @Test
    void stateAssignment_grantsDistrictsOfThatState_only() {
        UUID stateA = UUID.randomUUID();
        UUID stateB = UUID.randomUUID();
        State a = withId(new State(), stateA);
        GeographicScope scope = new GeographicScope(new UserAccount(), a, null, null, "admin");
        when(scopes.findByUser_Id(userId)).thenReturn(List.of(scope));
        UUID inA = UUID.randomUUID();
        UUID inB = UUID.randomUUID();
        when(districts.findById(inA)).thenReturn(Optional.of(district(inA, a, null)));
        when(districts.findById(inB)).thenReturn(Optional.of(district(inB, withId(new State(), stateB), null)));

        assertThat(service.canAccessDistrict(stateAdmin, inA)).isTrue();
        assertThat(service.canAccessDistrict(stateAdmin, inB)).isFalse();
    }

    @Test
    void divisionAssignment_grantsDistrictsOfThatDivision() {
        UUID divisionId = UUID.randomUUID();
        Division division = withId(new Division(), divisionId);
        when(scopes.findByUser_Id(userId)).thenReturn(List.of(new GeographicScope(new UserAccount(), null, division, null, "admin")));
        UUID inside = UUID.randomUUID();
        UUID outside = UUID.randomUUID();
        State state = withId(new State(), UUID.randomUUID());
        when(districts.findById(inside)).thenReturn(Optional.of(district(inside, state, division)));
        when(districts.findById(outside)).thenReturn(Optional.of(district(outside, state, null)));

        assertThat(service.canAccessDistrict(stateAdmin, inside)).isTrue();
        assertThat(service.canAccessDistrict(stateAdmin, outside)).isFalse();
    }

    @Test
    void districtAssignment_grantsOnlyThatDistrict() {
        UUID allowedId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        State state = withId(new State(), UUID.randomUUID());
        District allowed = district(allowedId, state, null);
        when(scopes.findByUser_Id(userId)).thenReturn(List.of(new GeographicScope(new UserAccount(), null, null, allowed, "admin")));
        when(districts.findById(allowedId)).thenReturn(Optional.of(allowed));
        when(districts.findById(otherId)).thenReturn(Optional.of(district(otherId, state, null)));

        assertThat(service.canAccessDistrict(stateAdmin, allowedId)).isTrue();
        assertThat(service.canAccessDistrict(stateAdmin, otherId)).isFalse();
    }

    @Test
    void requireDistrictAccess_outsideScope_isForbidden() {
        when(scopes.findByUser_Id(userId)).thenReturn(List.of());
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.of(district(districtId, withId(new State(), UUID.randomUUID()), null)));

        assertThatThrownBy(() -> service.requireDistrictAccess(stateAdmin, districtId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void requireDistrictAccess_unknownDistrict_isNotFound() {
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requireDistrictAccess(stateAdmin, districtId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void requireDistrictAccess_nationalRole_isAlwaysAllowed() {
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.of(district(districtId, withId(new State(), UUID.randomUUID()), null)));

        service.requireDistrictAccess(centralAdmin, districtId);
    }

    @Test
    void replaceScopes_entryWithTwoIds_isRejected_andNothingChanges() {
        when(users.findById(userId)).thenReturn(Optional.of(withId(new UserAccount(), userId)));

        assertThatThrownBy(() -> service.replaceScopes(userId,
                new UserScopesRequest(List.of(new ScopeEntryRequest(UUID.randomUUID(), UUID.randomUUID(), null))), centralAdmin))
                .isInstanceOf(InvalidRequestException.class);
        verify(scopes, never()).deleteAllForUser(any());
    }

    @Test
    void replaceScopes_entryWithNoId_isRejected() {
        when(users.findById(userId)).thenReturn(Optional.of(withId(new UserAccount(), userId)));

        assertThatThrownBy(() -> service.replaceScopes(userId,
                new UserScopesRequest(List.of(new ScopeEntryRequest(null, null, null))), centralAdmin))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void replaceScopes_unknownState_isNotFound() {
        UUID stateId = UUID.randomUUID();
        when(users.findById(userId)).thenReturn(Optional.of(withId(new UserAccount(), userId)));
        when(states.findById(stateId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.replaceScopes(userId,
                new UserScopesRequest(List.of(new ScopeEntryRequest(stateId, null, null))), centralAdmin))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(scopes, never()).deleteAllForUser(any());
    }

    @Test
    void replaceScopes_unknownUser_isNotFound() {
        when(users.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.replaceScopes(userId, new UserScopesRequest(List.of()), centralAdmin))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void replaceScopes_savesDistinctEntries_andAudits() {
        UUID stateId = UUID.randomUUID();
        UUID districtId = UUID.randomUUID();
        State state = withId(new State(), stateId);
        State other = withId(new State(), UUID.randomUUID());
        District district = district(districtId, other, null);
        when(users.findById(userId)).thenReturn(Optional.of(withId(new UserAccount(), userId)));
        when(states.findById(stateId)).thenReturn(Optional.of(state));
        when(districts.findById(districtId)).thenReturn(Optional.of(district));
        when(scopes.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<ScopeEntryResponse> result = service.replaceScopes(userId, new UserScopesRequest(List.of(
                new ScopeEntryRequest(stateId, null, null),
                new ScopeEntryRequest(stateId, null, null),
                new ScopeEntryRequest(null, null, districtId))), centralAdmin);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(ScopeEntryResponse::type).containsExactly("STATE", "DISTRICT");
        verify(scopes).deleteAllForUser(userId);
        verify(audit).record(eq("REPLACE_SCOPES"), eq("UserAccount"), eq(userId), anyString());
    }

    @Test
    void replaceScopes_emptyList_clearsAllScopes() {
        when(users.findById(userId)).thenReturn(Optional.of(withId(new UserAccount(), userId)));
        when(scopes.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.replaceScopes(userId, new UserScopesRequest(List.of()), centralAdmin)).isEmpty();
        verify(scopes).deleteAllForUser(userId);
    }

    @Test
    void geoScope_nationwide_allowsAnyDistrict() {
        UUID id = UUID.randomUUID();
        assertThat(GeoScope.everything().allows(district(id, withId(new State(), UUID.randomUUID()), null))).isTrue();
    }
}
