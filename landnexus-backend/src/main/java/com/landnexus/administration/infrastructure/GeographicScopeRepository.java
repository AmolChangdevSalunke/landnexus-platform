package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.GeographicScope;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GeographicScopeRepository extends JpaRepository<GeographicScope, UUID> {

    List<GeographicScope> findByUser_Id(UUID userId);

    @Modifying(flushAutomatically = true)
    @Query("delete from GeographicScope s where s.user.id = :userId")
    int deleteAllForUser(@Param("userId") UUID userId);
}
