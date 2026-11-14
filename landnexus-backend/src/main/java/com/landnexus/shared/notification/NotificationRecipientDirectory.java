package com.landnexus.shared.notification;

import java.util.Optional;
import java.util.UUID;

/**
 * Resolves the e-mail address and phone number of one user. Implemented by the administration
 * module so this package does not reach into the user table itself.
 */
public interface NotificationRecipientDirectory {

    Optional<Recipient> find(UUID userId);

    record Recipient(String email, boolean emailEnabled, String phone, boolean smsEnabled) {
    }
}
