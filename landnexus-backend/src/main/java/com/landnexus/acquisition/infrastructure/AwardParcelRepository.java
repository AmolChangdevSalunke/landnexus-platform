// AwardParcelRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.AwardParcel;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AwardParcelRepository extends JpaRepository<AwardParcel, UUID> {
    List<AwardParcel> findByAwardId(UUID awardId);
}