package com.landnexus.landrecords.infrastructure;

import com.landnexus.landrecords.domain.LandDocumentVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LandDocumentVersionRepository extends JpaRepository<LandDocumentVersion, UUID> {

    List<LandDocumentVersion> findByDocumentIdOrderByVersionNoAsc(UUID documentId);

    Optional<LandDocumentVersion> findByDocumentIdAndVersionNo(UUID documentId, int versionNo);
}