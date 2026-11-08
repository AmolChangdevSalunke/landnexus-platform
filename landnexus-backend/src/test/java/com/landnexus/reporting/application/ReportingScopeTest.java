package com.landnexus.reporting.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.reporting.infrastructure.DashboardRepository;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReportingScopeTest {

    @Mock private GeoScopeService geoScope;
    @Mock private DashboardRepository repo;

    private ReportingScope scopes;
    private final CurrentActor actor = new CurrentActor(UUID.randomUUID(), "user", Set.of("DISTRICT_ADMIN"), Set.of("DASHBOARD_READ"));
    private final UUID a = UUID.randomUUID();
    private final UUID b = UUID.randomUUID();
    private final UUID state = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        scopes = new ReportingScope(geoScope, repo);
    }

    @Test
    void aDistrictInScope_isUsedAlone() {
        when(geoScope.accessibleDistrictIds(actor)).thenReturn(Optional.of(Set.of(a, b)));
        when(geoScope.canAccessDistrict(actor, a)).thenReturn(true);

        DistrictScope s = scopes.resolve(actor, null, a);

        assertThat(s.unrestricted()).isFalse();
        assertThat(s.districtIds()).containsExactly(a);
    }

    @Test
    void aDistrictOutsideTheScope_isNotFound() {
        when(geoScope.accessibleDistrictIds(actor)).thenReturn(Optional.of(Set.of(a)));
        when(geoScope.canAccessDistrict(actor, b)).thenReturn(false);

        assertThatThrownBy(() -> scopes.resolve(actor, null, b)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void aState_isIntersectedWithTheCallersDistricts() {
        when(geoScope.accessibleDistrictIds(actor)).thenReturn(Optional.of(Set.of(a)));
        when(repo.districtIdsOfState(state)).thenReturn(Set.of(a, b));

        assertThat(scopes.resolve(actor, state, null).districtIds()).containsExactly(a);
    }

    @Test
    void aStateWithNothingVisible_orUnknown_isNotFound() {
        when(geoScope.accessibleDistrictIds(actor)).thenReturn(Optional.of(Set.of(a)));
        when(repo.districtIdsOfState(state)).thenReturn(Set.of(b));
        assertThatThrownBy(() -> scopes.resolve(actor, state, null)).isInstanceOf(ResourceNotFoundException.class);

        when(repo.districtIdsOfState(state)).thenReturn(Set.of());
        assertThatThrownBy(() -> scopes.resolve(actor, state, null)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void aNationalUser_isUnrestricted_andCanFilterAState() {
        when(geoScope.accessibleDistrictIds(actor)).thenReturn(Optional.empty());
        assertThat(scopes.resolve(actor, null, null).unrestricted()).isTrue();

        when(repo.districtIdsOfState(state)).thenReturn(Set.of(a, b));
        assertThat(scopes.resolve(actor, state, null).districtIds()).containsExactlyInAnyOrder(a, b);
    }

    @Test
    void aRestrictedUserWithNoDistricts_getsAScopeThatMatchesNothing() {
        when(geoScope.accessibleDistrictIds(actor)).thenReturn(Optional.of(Set.of()));

        DistrictScope s = scopes.resolve(actor, null, null);

        assertThat(s.isEmpty()).isTrue();
        assertThat(s.sql("p.district_id")).isEqualTo(" AND FALSE");
        assertThat(DistrictScope.all().sql("p.district_id")).isEmpty();
        assertThat(new DistrictScope(false, Set.of(a)).sql("p.district_id")).isEqualTo(" AND p.district_id IN (:ids)");
    }
}