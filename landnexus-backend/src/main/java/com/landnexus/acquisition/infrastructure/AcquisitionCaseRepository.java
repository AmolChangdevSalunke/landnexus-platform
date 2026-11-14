// AcquisitionCaseRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.AcquisitionCase;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AcquisitionCaseRepository extends JpaRepository<AcquisitionCase, UUID>, JpaSpecificationExecutor<AcquisitionCase> {

    @Query(value = "select nextval('acquisition_case_number_seq')", nativeQuery = true)
    Long nextNumber();

    /** Row lock: changes to a case's villages, parcels and status never run at the same moment. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AcquisitionCase c where c.id = :id")
    Optional<AcquisitionCase> findByIdForUpdate(@Param("id") UUID id);

    /** Read all cases for a project; multiple rows indicate legacy duplicate data that must be reconciled explicitly. */
    java.util.List<AcquisitionCase> findAllByProjectId(UUID projectId);

    /** V16 allows exactly one acquisition case per project. */
    boolean existsByProjectId(UUID projectId);
}