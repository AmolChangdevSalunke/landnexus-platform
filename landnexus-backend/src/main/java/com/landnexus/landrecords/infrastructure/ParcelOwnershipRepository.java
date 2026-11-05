package com.landnexus.landrecords.infrastructure;

import com.landnexus.landrecords.domain.ParcelOwnership;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParcelOwnershipRepository extends JpaRepository<ParcelOwnership, UUID> {

    List<ParcelOwnership> findByParcelIdOrderByFromDateAsc(UUID parcelId);

    List<ParcelOwnership> findByParcelIdAndToDateIsNull(UUID parcelId);

    boolean existsByParcelIdAndLandownerIdAndToDateIsNull(UUID parcelId, UUID landownerId);
}