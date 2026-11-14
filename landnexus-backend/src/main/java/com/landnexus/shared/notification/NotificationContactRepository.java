package com.landnexus.shared.notification;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationContactRepository extends JpaRepository<NotificationContact, UUID> {
}
