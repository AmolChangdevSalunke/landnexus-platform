// SurveyPhotoRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.SurveyPhoto;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SurveyPhotoRepository extends JpaRepository<SurveyPhoto, UUID> {
    List<SurveyPhoto> findBySurveyIdOrderByUploadedAtAsc(UUID surveyId);
    long countBySurveyId(UUID surveyId);
    Optional<SurveyPhoto> findByIdAndSurveyId(UUID id, UUID surveyId);
}