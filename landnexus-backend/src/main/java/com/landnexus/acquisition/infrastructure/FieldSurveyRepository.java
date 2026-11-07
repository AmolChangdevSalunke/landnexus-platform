// FieldSurveyRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.AcquisitionTypes.SurveyStatus;
import com.landnexus.acquisition.domain.FieldSurvey;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FieldSurveyRepository extends JpaRepository<FieldSurvey, UUID> {

    List<FieldSurvey> findByCaseIdOrderByCreatedAtAsc(UUID caseId);

    Optional<FieldSurvey> findFirstByCaseParcelIdAndStatusIn(UUID caseParcelId, Collection<SurveyStatus> statuses);

    boolean existsByCaseParcelId(UUID caseParcelId);

    @Query("select count(distinct s.caseParcelId) from FieldSurvey s where s.caseId = :caseId and s.status = :status")
    long countParcelsWithStatus(@Param("caseId") UUID caseId, @Param("status") SurveyStatus status);
}