package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.UserPermissionOverride;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPermissionOverrideRepository extends JpaRepository<UserPermissionOverride, UUID> {

    List<UserPermissionOverride> findByUser_Id(UUID userId);

    void deleteByUser_Id(UUID userId);
}
