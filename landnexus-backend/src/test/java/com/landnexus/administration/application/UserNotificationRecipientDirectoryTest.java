package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.notification.NotificationContact;
import com.landnexus.shared.notification.NotificationContactRepository;
import com.landnexus.shared.notification.NotificationRecipientDirectory;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserNotificationRecipientDirectoryTest {

    private static final Instant NOW = Instant.parse("2026-11-14T09:00:00Z");

    @Mock private UserAccountRepository users;
    @Mock private NotificationContactRepository contacts;

    private UserNotificationRecipientDirectory directory;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        directory = new UserNotificationRecipientDirectory(users, contacts);
    }

    @Test
    void withoutAContactRow_emailComesFromTheUser_andSmsIsOff() {
        UserAccount user = user("consultant@example.gov.in");
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(contacts.findById(userId)).thenReturn(Optional.empty());

        NotificationRecipientDirectory.Recipient recipient = directory.find(userId).orElseThrow();

        assertThat(recipient.email()).isEqualTo("consultant@example.gov.in");
        assertThat(recipient.emailEnabled()).isTrue();
        assertThat(recipient.phone()).isNull();
        assertThat(recipient.smsEnabled()).isFalse();
    }

    @Test
    void aContactRowCanOverrideTheEmail_andEnableSms() {
        UserAccount user = user("account@example.gov.in");
        NotificationContact contact = new NotificationContact(userId, "officer@example.gov.in",
                "+919876543210", false, true, NOW);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(contacts.findById(userId)).thenReturn(Optional.of(contact));

        NotificationRecipientDirectory.Recipient recipient = directory.find(userId).orElseThrow();

        assertThat(recipient.email()).isEqualTo("officer@example.gov.in");
        assertThat(recipient.emailEnabled()).isFalse();
        assertThat(recipient.phone()).isEqualTo("+919876543210");
        assertThat(recipient.smsEnabled()).isTrue();
    }

    @Test
    void smsStaysOffWhenTheContactHasNoPhone() {
        NotificationContact contact = new NotificationContact(userId, null, "  ", true, true, NOW);
        when(users.findById(userId)).thenReturn(Optional.of(user("account@example.gov.in")));
        when(contacts.findById(userId)).thenReturn(Optional.of(contact));

        NotificationRecipientDirectory.Recipient recipient = directory.find(userId).orElseThrow();

        assertThat(recipient.email()).isEqualTo("account@example.gov.in");
        assertThat(recipient.phone()).isEqualTo("  ");
        assertThat(recipient.smsEnabled()).isFalse();
    }

    @Test
    void unknownUser_hasNoRecipient() {
        when(users.findById(userId)).thenReturn(Optional.empty());

        assertThat(directory.find(userId)).isEmpty();
    }

    private UserAccount user(String email) {
        UserAccount user = new UserAccount();
        user.setEmail(email);
        return user;
    }
}
