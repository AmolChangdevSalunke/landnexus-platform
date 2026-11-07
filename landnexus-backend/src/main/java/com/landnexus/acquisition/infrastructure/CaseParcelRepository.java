// CaseParcelRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.CaseParcel;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CaseParcelRepository extends JpaRepository<CaseParcel, UUID> {

    List<CaseParcel> findByCaseIdAndReleasedAtIsNullOrderByIdentifiedAtAsc(UUID caseId);

    long countByCaseIdAndReleasedAtIsNull(UUID caseId);

    boolean existsByCaseIdAndParcelId(UUID caseId, UUID parcelId);

    boolean existsByParcelIdAndReleasedAtIsNull(UUID parcelId);

    boolean existsByCaseIdAndVillageIdIn(UUID caseId, Collection<UUID> villageIds);

    List<CaseParcel> findByAssignedSurveyorUserIdAndReleasedAtIsNull(UUID surveyorUserId);

    @Modifying(flushAutomatically = true)
    @Query("update CaseParcel p set p.releasedAt = :now where p.caseId = :caseId and p.releasedAt is null")
    int releaseAll(@Param("caseId") UUID caseId, @Param("now") Instant now);
}