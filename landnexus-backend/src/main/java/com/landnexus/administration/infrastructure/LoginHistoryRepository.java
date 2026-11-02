package com.landnexus.administration.infrastructure;

import com.landnexus.administration.domain.LoginHistory;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginHistoryRepository extends JpaRepository<LoginHistory, UUID> {

    Page<LoginHistory> findByUsernameAttempted(String usernameAttempted, Pageable pageable);
}
