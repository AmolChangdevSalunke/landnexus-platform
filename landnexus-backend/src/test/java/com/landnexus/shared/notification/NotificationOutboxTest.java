package com.landnexus.shared.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationOutboxTest {

    private static final Instant NOW = Instant.parse("2026-11-14T09:00:00Z");
    private static final UUID NOTIFICATION_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();

    @Mock private NotificationDeliveryRepository deliveries;
    @Mock private NotificationRecipientDirectory directory;

    private NotificationOutbox outbox;
    private Notification notification;

    @BeforeEach
    void setUp() {
        NotificationProperties properties = new NotificationProperties("",
                new NotificationProperties.Email("log", "no-reply@landnexus.local", "", "", 10),
                new NotificationProperties.Sms("log", "LANDNEXUS", "", "", 10),
                new NotificationProperties.Retry(3, 1000, 10_000));
        NotificationChannelRegistry registry = new NotificationChannelRegistry(List.of(
                adapter(NotificationChannel.EMAIL, true), adapter(NotificationChannel.SMS, true)));
        outbox = new NotificationOutbox(deliveries, directory, registry, properties,
                Clock.fixed(NOW, ZoneOffset.UTC));
        notification = mock(Notification.class);
        when(notification.getId()).thenReturn(NOTIFICATION_ID);
        lenient().when(notification.getRecipientUserId()).thenReturn(USER_ID);
    }

    @Test
    void enqueue_writesOnePendingRowPerConfiguredChannel_withMaskedDestinations() {
        when(directory.find(USER_ID)).thenReturn(Optional.of(new NotificationRecipientDirectory.Recipient(
                "john.doe@example.com", true, "+919876543210", true)));

        assertThat(outbox.enqueue(notification)).isEqualTo(2);

        ArgumentCaptor<NotificationDelivery> saved = ArgumentCaptor.forClass(NotificationDelivery.class);
        verify(deliveries, org.mockito.Mockito.times(2)).save(saved.capture());
        NotificationDelivery email = saved.getAllValues().get(0);
        NotificationDelivery sms = saved.getAllValues().get(1);
        assertThat(email.getChannel()).isEqualTo(NotificationChannel.EMAIL);
        assertThat(email.getDestinationMasked()).isEqualTo("j***e@example.com");
        assertThat(email.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(email.getAttempts()).isZero();
        assertThat(email.getMaxAttempts()).isEqualTo(3);
        assertThat(email.getDedupeKey()).isEqualTo(NOTIFICATION_ID + ":EMAIL");
        assertThat(sms.getChannel()).isEqualTo(NotificationChannel.SMS);
        assertThat(sms.getDestinationMasked()).isEqualTo("******3210");
    }

    @Test
    void enqueue_skipsAChannelThatWasAlreadyQueued() {
        when(directory.find(USER_ID)).thenReturn(Optional.of(new NotificationRecipientDirectory.Recipient(
                "john@example.com", true, "+919876543210", true)));
        when(deliveries.existsByNotificationIdAndChannel(NOTIFICATION_ID, NotificationChannel.EMAIL)).thenReturn(true);

        assertThat(outbox.enqueue(notification)).isEqualTo(1);

        ArgumentCaptor<NotificationDelivery> saved = ArgumentCaptor.forClass(NotificationDelivery.class);
        verify(deliveries).save(saved.capture());
        assertThat(saved.getValue().getChannel()).isEqualTo(NotificationChannel.SMS);
    }

    @Test
    void enqueue_doesNothingWhenBothProvidersAreOff() {
        NotificationChannelRegistry off = new NotificationChannelRegistry(List.of(
                adapter(NotificationChannel.EMAIL, false), adapter(NotificationChannel.SMS, false)));
        NotificationOutbox disabled = new NotificationOutbox(deliveries, directory, off,
                new NotificationProperties("", null, null, null), Clock.fixed(NOW, ZoneOffset.UTC));

        assertThat(disabled.enqueue(notification)).isZero();

        verifyNoInteractions(deliveries);
        verifyNoInteractions(directory);
    }

    @Test
    void enqueue_respectsPerChannelPreferencesAndMissingContacts() {
        when(directory.find(USER_ID)).thenReturn(Optional.of(new NotificationRecipientDirectory.Recipient(
                "john@example.com", true, "+919876543210", false)));

        assertThat(outbox.enqueue(notification)).isEqualTo(1);
        verify(deliveries).save(any(NotificationDelivery.class));
        ArgumentCaptor<NotificationDelivery> saved = ArgumentCaptor.forClass(NotificationDelivery.class);
        verify(deliveries).save(saved.capture());
        assertThat(saved.getValue().getChannel()).isEqualTo(NotificationChannel.EMAIL);
    }

    @Test
    void enqueue_doesNothingWhenTheUserCannotBeResolved() {
        when(directory.find(USER_ID)).thenReturn(Optional.empty());

        assertThat(outbox.enqueue(notification)).isZero();

        verify(deliveries, never()).save(any());
    }

    @Test
    void enqueue_refusesAnUnsavedNotification() {
        when(notification.getId()).thenReturn(null);

        assertThatThrownBy(() -> outbox.enqueue(notification)).isInstanceOf(IllegalStateException.class);
    }

    private static NotificationChannelAdapter adapter(NotificationChannel channel, boolean enabled) {
        return new NotificationChannelAdapter() {
            @Override
            public NotificationChannel channel() {
                return channel;
            }

            @Override
            public String providerName() {
                return "test";
            }

            @Override
            public boolean enabled() {
                return enabled;
            }

            @Override
            public void send(OutboundNotification notification) {
            }
        };
    }
}
