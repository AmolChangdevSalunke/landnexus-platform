package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.Department;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository extends JpaRepository<Department, UUID> {

    boolean existsByCode(String code);
    boolean existsByCodeAndIdNot(String code, UUID id);
    Page<Department> findByMinistry_Id(UUID ministryId, Pageable pageable);
}
