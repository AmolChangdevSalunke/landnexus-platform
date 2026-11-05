package com.landnexus.landrecords.infrastructure;

import com.landnexus.landrecords.domain.ParcelMutation;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParcelMutationRepository extends JpaRepository<ParcelMutation, UUID> {

    List<ParcelMutation> findByParcelIdOrderByMutationDateDesc(UUID parcelId);

    boolean existsByParcelIdAndMutationNumber(UUID parcelId, String mutationNumber);
}