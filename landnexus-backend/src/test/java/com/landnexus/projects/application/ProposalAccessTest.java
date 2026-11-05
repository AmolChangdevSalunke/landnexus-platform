package com.landnexus.projects.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.GeoScopeService;
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
class ProposalAccessTest {

    @Mock private GeoScopeService geoScope;

    private ProposalAccess access;

    private final UUID me = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final CurrentActor officer = new CurrentActor(me, "officer", Set.of("SCRUTINY_OFFICER"), Set.of("PROPOSAL_READ"));
    private final CurrentActor consultant = new CurrentActor(me, "consultant", Set.of("CONSULTANT"), Set.of("PROPOSAL_READ_OWN"));
    private final CurrentActor nobody = new CurrentActor(me, "nobody", Set.of("CITIZEN"), Set.of());

    @BeforeEach
    void setUp() {
        access = new ProposalAccess(geoScope);
    }

    @Test
    void officer_seesRecordsInScope_only() {
        when(geoScope.canAccessDistrict(officer, districtId)).thenReturn(true);

        assertThat(access.canView(officer, districtId, UUID.randomUUID())).isTrue();
    }

    @Test
    void officer_doesNotSeeRecordsOutsideScope() {
        when(geoScope.canAccessDistrict(officer, districtId)).thenReturn(false);

        assertThat(access.canView(officer, districtId, me)).isFalse();
    }

    @Test
    void consultant_seesOnlyOwnRecords() {
        assertThat(access.canView(consultant, districtId, me)).isTrue();
        assertThat(access.canView(consultant, districtId, UUID.randomUUID())).isFalse();
    }

    @Test
    void userWithoutReadPermission_seesNothing() {
        assertThat(access.canView(nobody, districtId, me)).isFalse();
    }

    @Test
    void visibleTo_alwaysReturnsAFilter() {
        when(geoScope.accessibleDistrictIds(officer)).thenReturn(Optional.empty());

        assertThat(access.<Object>visibleTo(officer)).isNotNull();
        assertThat(access.<Object>visibleTo(consultant)).isNotNull();
        assertThat(access.<Object>visibleTo(nobody)).isNotNull();
        verify(geoScope).accessibleDistrictIds(officer);
    }

    @Test
    void visibleTo_withEmptyScope_isStillAFilter() {
        when(geoScope.accessibleDistrictIds(officer)).thenReturn(Optional.of(Set.of()));

        assertThat(access.<Object>visibleTo(officer)).isNotNull();
    }
}
