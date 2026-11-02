package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.District;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Read-only lookups of districts by geographic scope (kept apart from the plain master-data repository). */
public interface DistrictLookupRepository extends JpaRepository<District, UUID> {

    @Query("select d from District d where d.state.id in :stateIds or d.division.id in :divisionIds or d.id in :districtIds")
    Page<District> findAccessible(@Param("stateIds") Collection<UUID> stateIds,
                                  @Param("divisionIds") Collection<UUID> divisionIds,
                                  @Param("districtIds") Collection<UUID> districtIds,
                                  Pageable pageable);
}
