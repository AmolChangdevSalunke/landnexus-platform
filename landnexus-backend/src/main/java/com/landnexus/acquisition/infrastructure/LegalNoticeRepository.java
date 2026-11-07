// LegalNoticeRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.AcquisitionTypes.NoticeType;
import com.landnexus.acquisition.domain.LegalNotice;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LegalNoticeRepository extends JpaRepository<LegalNotice, UUID> {
    List<LegalNotice> findByCaseIdOrderByIssuedOnAsc(UUID caseId);
    Optional<LegalNotice> findFirstByCaseIdAndNoticeTypeOrderByIssuedOnDesc(UUID caseId, NoticeType noticeType);
    boolean existsByCaseIdAndReferenceNumber(UUID caseId, String referenceNumber);
}