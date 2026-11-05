package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.UserAccount;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findByUsername(String username);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    @Query("select distinct u from UserAccount u join u.roles r where r.code = :roleCode and u.enabled = true")
    List<UserAccount> findEnabledByRoleCode(@Param("roleCode") String roleCode);
}
