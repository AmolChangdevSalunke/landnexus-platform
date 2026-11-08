package com.landnexus.landrecords.infrastructure;

import com.landnexus.landrecords.domain.LandParcel;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface LandParcelRepository extends JpaRepository<LandParcel, UUID>, JpaSpecificationExecutor<LandParcel> {

    boolean existsByVillageIdAndParcelKey(UUID villageId, String parcelKey);

    boolean existsByVillageIdAndParcelKeyAndIdNot(UUID villageId, String parcelKey, UUID id);

    /** Row lock: ownership shares are checked and changed while nobody else touches the same parcel. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from LandParcel p where p.id = :id")
    Optional<LandParcel> findByIdForUpdate(@Param("id") UUID id);
    @Query("select p.id from LandParcel p where p.villageId = :villageId")
    List<UUID> findIdsByVillageId(@Param("villageId") UUID villageId);
}
