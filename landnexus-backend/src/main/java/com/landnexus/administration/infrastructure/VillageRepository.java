package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.Village;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VillageRepository extends JpaRepository<Village, UUID> {

    boolean existsByTaluka_IdAndCode(UUID talukaId, String code);
    boolean existsByTaluka_IdAndCodeAndIdNot(UUID talukaId, String code, UUID id);
    Page<Village> findByTaluka_Id(UUID talukaId, Pageable pageable);
}
