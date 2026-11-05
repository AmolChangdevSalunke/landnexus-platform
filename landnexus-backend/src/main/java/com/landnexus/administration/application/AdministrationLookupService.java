package com.landnexus.administration.application;

import com.landnexus.administration.domain.District;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.administration.domain.Taluka;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.domain.Village;
import com.landnexus.administration.infrastructure.DepartmentRepository;
import com.landnexus.administration.infrastructure.DistrictRepository;
import com.landnexus.administration.infrastructure.TalukaRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.administration.infrastructure.VillageRepository;
import com.landnexus.shared.security.CurrentActor;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The published, read-only API other modules use to ask about administrative data.
 * Other modules never touch administration repositories or entities directly.
 */
@Service
@Transactional(readOnly = true)
public class AdministrationLookupService {

    public record DistrictRef(UUID id, String name, UUID stateId) {
    }

    public record TalukaRef(UUID id, String name, UUID districtId) {
    }

    public record VillageRef(UUID id, String name, UUID districtId) {
    }

    public record UserRef(UUID id, String username) {
    }

    private final DistrictRepository districts;
    private final TalukaRepository talukas;
    private final VillageRepository villages;
    private final DepartmentRepository departments;
    private final UserAccountRepository users;
    private final GeoScopeService geoScope;

    public AdministrationLookupService(DistrictRepository districts, TalukaRepository talukas,
                                       VillageRepository villages, DepartmentRepository departments,
                                       UserAccountRepository users, GeoScopeService geoScope) {
        this.districts = districts;
        this.talukas = talukas;
        this.villages = villages;
        this.departments = departments;
        this.users = users;
        this.geoScope = geoScope;
    }

    public Optional<DistrictRef> findActiveDistrict(UUID id) {
        return districts.findById(id)
                .filter(d -> d.getStatus() == RecordStatus.ACTIVE)
                .map(d -> new DistrictRef(d.getId(), d.getName(), d.getState().getId()));
    }

    public Optional<TalukaRef> findActiveTaluka(UUID id) {
        return talukas.findById(id)
                .filter(t -> t.getStatus() == RecordStatus.ACTIVE)
                .map(t -> new TalukaRef(t.getId(), t.getName(), t.getDistrict().getId()));
    }

    /** Returns only the villages that exist and are active; the caller compares sizes to detect unknown ids. */
    public List<VillageRef> findActiveVillages(Collection<UUID> ids) {
        List<VillageRef> result = new ArrayList<>();
        for (Village village : villages.findAllById(ids)) {
            if (village.getStatus() == RecordStatus.ACTIVE) {
                Taluka taluka = village.getTaluka();
                result.add(new VillageRef(village.getId(), village.getName(), taluka.getDistrict().getId()));
            }
        }
        return result;
    }

    public boolean departmentIsActive(UUID id) {
        return departments.findById(id).filter(d -> d.getStatus() == RecordStatus.ACTIVE).isPresent();
    }

    /** Enabled users holding the role whose geographic scope covers the district (e.g. the scrutiny officers to notify). */
    public List<UserRef> findUsersByRoleWithDistrictAccess(String roleCode, UUID districtId) {
        District district = districts.findById(districtId).orElse(null);
        if (district == null) {
            return List.of();
        }
        List<UserRef> result = new ArrayList<>();
        for (UserAccount user : users.findEnabledByRoleCode(roleCode)) {
            CurrentActor actor = new CurrentActor(user.getId(), user.getUsername(), user.roleCodes());
            if (geoScope.resolve(actor).allows(district)) {
                result.add(new UserRef(user.getId(), user.getUsername()));
            }
        }
        return result;
    }
}
