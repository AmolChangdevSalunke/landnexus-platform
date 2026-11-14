package com.landnexus.shared.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.shared.audit.AuditService;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class NotificationDeliveryAttemptServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-14T09:00:00Z");
    private static final UUID DELIVERY_ID = UUID.randomUUID();
    private static final UUID NOTIFICATION_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID ENTITY_ID = UUID.randomUUID();

    @Mock private NotificationDeliveryRepository deliveries;
    @Mock private NotificationRepository notifications;
    @Mock private NotificationRecipientDirectory directory;
    @Mock private AuditService audit;

    private RecordingAdapter email;
    private RecordingAdapter sms;
    private NotificationDeliveryAttemptService service;
    private Notification notification;

    @BeforeEach
    void setUp() {
        NotificationProperties properties = new NotificationProperties("http://localhost:5173",
                new NotificationProperties.Email("log", "no-reply@landnexus.local", "", "", 10),
                new NotificationProperties.Sms("log", "LANDNEXUS", "", "", 10),
                new NotificationProperties.Retry(3, 1000, 10_000));
        NotificationTemplateService templates = new NotificationTemplateService(properties);
        email = new RecordingAdapter(NotificationChannel.EMAIL);
        sms = new RecordingAdapter(NotificationChannel.SMS);
        NotificationChannelRegistry registry = new NotificationChannelRegistry(List.of(email, sms));
        service = new NotificationDeliveryAttemptService(deliveries, notifications, directory, registry,
                templates, properties, audit, Clock.fixed(NOW, ZoneOffset.UTC));
        notification = new Notification(USER_ID, "PROPOSAL", "Proposal approved",
                "Your proposal was approved.", "Proposal", ENTITY_ID, NOW);
    }

    @Test
    void attempt_sendsThroughTheAdapter_andMarksTheRowSent() {
        NotificationDelivery delivery = delivery(NotificationChannel.EMAIL, 3, NOW.minusSeconds(1));
        givenDue(delivery);
        givenNotification();
        givenRecipient("john.doe@example.com", true, "+919876543210", true);
        assertThat(service.attempt(DELIVERY_ID)).isTrue();

        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(delivery.getAttempts()).isEqualTo(1);
        assertThat(delivery.getSentAt()).isEqualTo(NOW);
        assertThat(delivery.getProvider()).isEqualTo("test");
        assertThat(email.last.destination()).isEqualTo("john.doe@example.com");
        assertThat(email.last.maskedDestination()).isEqualTo("j***e@example.com");
        assertThat(email.last.subject()).isEqualTo("[LandNexus] Proposal approved");
        assertThat(email.last.body()).contains("Your proposal was approved.");
        verify(audit).recordAs(isNull(), eq("system"), eq("NOTIFICATION_DELIVERY_SENT"),
                eq("NotificationDelivery"), eq(DELIVERY_ID), contains("j***e@example.com"));
    }

    @Test
    void attempt_providerFailure_schedulesARetryWithBackoff() {
        NotificationDelivery delivery = delivery(NotificationChannel.EMAIL, 3, NOW.minusSeconds(1));
        givenDue(delivery);
        givenNotification();
        givenRecipient("john@example.com", true, null, false);
        email.failure = new NotificationDeliveryException("provider returned HTTP 500");

        assertThat(service.attempt(DELIVERY_ID)).isFalse();

        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.RETRY);
        assertThat(delivery.getAttempts()).isEqualTo(1);
        assertThat(delivery.getLastError()).isEqualTo("provider returned HTTP 500");
        assertThat(delivery.getNextAttemptAt()).isEqualTo(NOW.plusMillis(1000));
        verify(audit).recordAs(isNull(), eq("system"), eq("NOTIFICATION_DELIVERY_RETRY"),
                eq("NotificationDelivery"), eq(DELIVERY_ID), anyString());
    }

    @Test
    void attempt_exhaustedFailure_isFinal_andKeepsNoNextAttempt() {
        NotificationDelivery delivery = delivery(NotificationChannel.EMAIL, 1, NOW.minusSeconds(1));
        givenDue(delivery);
        givenNotification();
        givenRecipient("john@example.com", true, null, false);
        email.failure = new NotificationDeliveryException("provider returned HTTP 500");

        assertThat(service.attempt(DELIVERY_ID)).isFalse();

        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(delivery.getAttempts()).isEqualTo(1);
        assertThat(delivery.getNextAttemptAt()).isNull();
        verify(audit).recordAs(isNull(), eq("system"), eq("NOTIFICATION_DELIVERY_FAILED"),
                eq("NotificationDelivery"), eq(DELIVERY_ID), anyString());
    }

    @Test
    void attempt_alreadySent_isNotSentTwice() {
        NotificationDelivery delivery = delivery(NotificationChannel.EMAIL, 3, NOW.minusSeconds(1));
        delivery.markSent(NOW.minusSeconds(30), "test");
        givenDue(delivery);

        assertThat(service.attempt(DELIVERY_ID)).isFalse();
        assertThat(email.last).isNull();
    }

    @Test
    void attempt_withoutADestination_failsWithoutCallingTheAdapter() {
        NotificationDelivery delivery = delivery(NotificationChannel.EMAIL, 3, NOW.minusSeconds(1));
        givenDue(delivery);
        givenNotification();
        when(directory.find(USER_ID)).thenReturn(Optional.empty());

        assertThat(service.attempt(DELIVERY_ID)).isFalse();

        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.RETRY);
        assertThat(delivery.getLastError()).contains("No deliverable EMAIL destination");
        assertThat(email.last).isNull();
    }

    @Test
    void attempt_smsUsesTheSmsBody_andNeverStoresTheRawPhone() {
        NotificationDelivery delivery = delivery(NotificationChannel.SMS, 3, NOW.minusSeconds(1));
        givenDue(delivery);
        givenNotification();
        givenRecipient("john@example.com", true, "+919876543210", true);

        assertThat(service.attempt(DELIVERY_ID)).isTrue();

        assertThat(sms.last.destination()).isEqualTo("+919876543210");
        assertThat(sms.last.body()).startsWith("LandNexus: Proposal approved.");
        ArgumentCaptor<String> details = ArgumentCaptor.forClass(String.class);
        verify(audit).recordAs(isNull(), eq("system"), eq("NOTIFICATION_DELIVERY_SENT"),
                eq("NotificationDelivery"), eq(DELIVERY_ID), details.capture());
        assertThat(details.getValue())
                .contains("******3210")
                .doesNotContain("+919876543210");
    }

    @Test
    void attempt_providerOff_leavesTheRowPendingWithoutBurningAnAttempt() {
        NotificationDelivery delivery = delivery(NotificationChannel.EMAIL, 3, NOW.minusSeconds(1));
        givenDue(delivery);
        email.enabled = false;

        assertThat(service.attempt(DELIVERY_ID)).isFalse();

        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        assertThat(delivery.getAttempts()).isZero();
        verify(directory, never()).find(any());
    }

    private void givenDue(NotificationDelivery delivery) {
        when(deliveries.findByIdForUpdate(DELIVERY_ID)).thenReturn(Optional.of(delivery));
    }

    private void givenNotification() {
        when(notifications.findById(NOTIFICATION_ID)).thenReturn(Optional.of(notification));
    }

    private void givenRecipient(String emailAddress, boolean emailEnabled, String phone, boolean smsEnabled) {
        when(directory.find(USER_ID)).thenReturn(Optional.of(
                new NotificationRecipientDirectory.Recipient(emailAddress, emailEnabled, phone, smsEnabled)));
    }

    private NotificationDelivery delivery(NotificationChannel channel, int maxAttempts, Instant nextAttempt) {
        String dedupe = NOTIFICATION_ID + ":" + channel.name();
        NotificationDelivery delivery = new NotificationDelivery(NOTIFICATION_ID, USER_ID, channel,
                channel == NotificationChannel.EMAIL ? "j***e@example.com" : "******3210",
                maxAttempts, dedupe, nextAttempt);
        ReflectionTestUtils.setField(delivery, "id", DELIVERY_ID);
        return delivery;
    }

    private static final class RecordingAdapter implements NotificationChannelAdapter {
        private final NotificationChannel channel;
        private boolean enabled = true;
        private RuntimeException failure;
        private OutboundNotification last;

        private RecordingAdapter(NotificationChannel channel) {
            this.channel = channel;
        }

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
            if (failure != null) {
                throw failure;
            }
            last = notification;
        }
    }
}
