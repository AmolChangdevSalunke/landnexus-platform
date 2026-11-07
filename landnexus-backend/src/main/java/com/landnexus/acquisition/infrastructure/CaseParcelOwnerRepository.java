// CaseParcelOwnerRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.CaseParcelOwner;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CaseParcelOwnerRepository extends JpaRepository<CaseParcelOwner, UUID> {

    List<CaseParcelOwner> findByCaseParcelIdIn(Collection<UUID> caseParcelIds);

    void deleteByCaseParcelId(UUID caseParcelId);
}