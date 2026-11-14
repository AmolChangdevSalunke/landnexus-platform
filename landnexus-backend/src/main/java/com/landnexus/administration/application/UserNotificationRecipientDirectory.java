package com.landnexus.administration.application;

import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.notification.NotificationContact;
import com.landnexus.shared.notification.NotificationContactRepository;
import com.landnexus.shared.notification.NotificationRecipientDirectory;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The administration side of notification recipient lookup. EMAIL falls back to the address on
 * the user account; SMS needs an explicit contact row with a phone number and sms_enabled.
 */
@Component
public class UserNotificationRecipientDirectory implements NotificationRecipientDirectory {

    private final UserAccountRepository users;
    private final NotificationContactRepository contacts;

    public UserNotificationRecipientDirectory(UserAccountRepository users, NotificationContactRepository contacts) {
        this.users = users;
        this.contacts = contacts;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Recipient> find(UUID userId) {
        return users.findById(userId).map(user -> toRecipient(user, contacts.findById(userId).orElse(null)));
    }

    private static Recipient toRecipient(UserAccount user, NotificationContact contact) {
        String contactEmail = contact == null ? null : contact.getEmail();
        String email = contactEmail != null && !contactEmail.isBlank() ? contactEmail : user.getEmail();
        boolean emailEnabled = contact == null || contact.isEmailEnabled();

        String phone = contact == null ? null : contact.getPhone();
        boolean smsEnabled = contact != null && contact.isSmsEnabled()
                && phone != null && !phone.isBlank();
        return new Recipient(email, emailEnabled, phone, smsEnabled);
    }
}
