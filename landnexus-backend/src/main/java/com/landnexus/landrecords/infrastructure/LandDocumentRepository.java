package com.landnexus.landrecords.infrastructure;

import com.landnexus.landrecords.domain.LandDocument;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LandDocumentRepository extends JpaRepository<LandDocument, UUID> {

    List<LandDocument> findByParcelIdOrderByCreatedAtDesc(UUID parcelId);
}