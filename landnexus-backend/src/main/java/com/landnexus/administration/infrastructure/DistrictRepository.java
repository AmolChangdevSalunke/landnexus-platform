package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.District;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DistrictRepository extends JpaRepository<District, UUID> {

    boolean existsByState_IdAndCode(UUID stateId, String code);
    boolean existsByState_IdAndCodeAndIdNot(UUID stateId, String code, UUID id);
    Page<District> findByState_Id(UUID stateId, Pageable pageable);
}
