package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.Ministry;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MinistryRepository extends JpaRepository<Ministry, UUID> {

    boolean existsByCode(String code);
    boolean existsByCodeAndIdNot(String code, UUID id);
}
