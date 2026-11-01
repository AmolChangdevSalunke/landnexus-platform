package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.Taluka;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TalukaRepository extends JpaRepository<Taluka, UUID> {

    boolean existsByDistrict_IdAndCode(UUID districtId, String code);
    boolean existsByDistrict_IdAndCodeAndIdNot(UUID districtId, String code, UUID id);
    Page<Taluka> findByDistrict_Id(UUID districtId, Pageable pageable);
}
