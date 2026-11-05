package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.AdministrationLookupService.DistrictRef;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.administration.application.AdministrationLookupService.VillageRef;
import com.landnexus.administration.domain.Department;
import com.landnexus.administration.domain.District;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.State;
import com.landnexus.administration.domain.Taluka;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.domain.Village;
import com.landnexus.administration.infrastructure.DepartmentRepository;
import com.landnexus.administration.infrastructure.DistrictRepository;
import com.landnexus.administration.infrastructure.TalukaRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.administration.infrastructure.VillageRepository;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AdministrationLookupServiceTest {

    @Mock private DistrictRepository districts;
    @Mock private TalukaRepository talukas;
    @Mock private VillageRepository villages;
    @Mock private DepartmentRepository departments;
    @Mock private UserAccountRepository users;
    @Mock private GeoScopeService geoScope;

    private AdministrationLookupService service;

    @BeforeEach
    void setUp() {
        service = new AdministrationLookupService(districts, talukas, villages, departments, users, geoScope);
    }

    private static <T> T withId(T entity, UUID id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }

    @Test
    void findActiveDistrict_returnsTheDistrictWithItsState() {
        UUID stateId = UUID.randomUUID();
        UUID districtId = UUID.randomUUID();
        District district = withId(new District(), districtId);
        district.setName("Pune");
        district.setState(withId(new State(), stateId));
        when(districts.findById(districtId)).thenReturn(Optional.of(district));

        Optional<DistrictRef> ref = service.findActiveDistrict(districtId);

        assertThat(ref).isPresent();
        assertThat(ref.get().stateId()).isEqualTo(stateId);
        assertThat(ref.get().name()).isEqualTo("Pune");
    }

    @Test
    void findActiveDistrict_inactiveOrUnknown_isEmpty() {
        UUID inactiveId = UUID.randomUUID();
        District inactive = withId(new District(), inactiveId);
        inactive.setStatus(RecordStatus.INACTIVE);
        inactive.setState(withId(new State(), UUID.randomUUID()));
        UUID unknownId = UUID.randomUUID();
        when(districts.findById(inactiveId)).thenReturn(Optional.of(inactive));
        when(districts.findById(unknownId)).thenReturn(Optional.empty());

        assertThat(service.findActiveDistrict(inactiveId)).isEmpty();
        assertThat(service.findActiveDistrict(unknownId)).isEmpty();
    }

    @Test
    void findActiveVillages_skipsInactiveOnes_andResolvesTheDistrict() {
        UUID districtId = UUID.randomUUID();
        District district = withId(new District(), districtId);
        Taluka taluka = withId(new Taluka(), UUID.randomUUID());
        taluka.setDistrict(district);
        UUID activeId = UUID.randomUUID();
        UUID inactiveId = UUID.randomUUID();
        Village active = withId(new Village(), activeId);
        active.setName("Active");
        active.setTaluka(taluka);
        Village inactive = withId(new Village(), inactiveId);
        inactive.setTaluka(taluka);
        inactive.setStatus(RecordStatus.INACTIVE);
        when(villages.findAllById(any())).thenReturn(List.of(active, inactive));

        List<VillageRef> refs = service.findActiveVillages(Set.of(activeId, inactiveId));

        assertThat(refs).hasSize(1);
        assertThat(refs.get(0).districtId()).isEqualTo(districtId);
    }

    @Test
    void departmentIsActive_checksTheStatus() {
        UUID activeId = UUID.randomUUID();
        UUID inactiveId = UUID.randomUUID();
        Department inactive = withId(new Department(), inactiveId);
        inactive.setStatus(RecordStatus.INACTIVE);
        when(departments.findById(activeId)).thenReturn(Optional.of(withId(new Department(), activeId)));
        when(departments.findById(inactiveId)).thenReturn(Optional.of(inactive));

        assertThat(service.departmentIsActive(activeId)).isTrue();
        assertThat(service.departmentIsActive(inactiveId)).isFalse();
    }

    @Test
    void findUsersByRoleWithDistrictAccess_returnsOnlyUsersWhoseScopeCoversTheDistrict() {
        UUID districtId = UUID.randomUUID();
        District district = withId(new District(), districtId);
        UUID insideId = UUID.randomUUID();
        UUID outsideId = UUID.randomUUID();
        UserAccount inside = withId(new UserAccount(), insideId);
        inside.setUsername("inside");
        inside.getRoles().add(new Role("SCRUTINY_OFFICER", "Officer", "x"));
        UserAccount outside = withId(new UserAccount(), outsideId);
        outside.setUsername("outside");
        outside.getRoles().add(new Role("SCRUTINY_OFFICER", "Officer", "x"));
        when(districts.findById(districtId)).thenReturn(Optional.of(district));
        when(users.findEnabledByRoleCode("SCRUTINY_OFFICER")).thenReturn(List.of(inside, outside));
        when(geoScope.resolve(any(CurrentActor.class))).thenAnswer(inv -> {
            CurrentActor actor = inv.getArgument(0);
            return actor.userId().equals(insideId)
                    ? GeoScope.everything()
                    : new GeoScope(false, Set.of(), Set.of(), Set.of());
        });

        List<UserRef> result = service.findUsersByRoleWithDistrictAccess("SCRUTINY_OFFICER", districtId);

        assertThat(result).extracting(UserRef::username).containsExactly("inside");
    }

    @Test
    void findUsersByRoleWithDistrictAccess_unknownDistrict_isEmpty() {
        UUID districtId = UUID.randomUUID();
        when(districts.findById(districtId)).thenReturn(Optional.empty());

        assertThat(service.findUsersByRoleWithDistrictAccess("SCRUTINY_OFFICER", districtId)).isEmpty();
    }
}
