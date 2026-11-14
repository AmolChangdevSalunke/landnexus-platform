package com.landnexus.shared.notification;

import com.landnexus.shared.audit.AuditService;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Processes exactly one delivery row. The row is locked for update before the provider call, so
 * two instances (or two scheduler ticks) cannot send it twice. A provider failure is recorded on
 * the row; it never propagates to the business transaction that created the notification.
 */
@Service
public class NotificationDeliveryAttemptService {

    private static final Logger log = LoggerFactory.getLogger(NotificationDeliveryAttemptService.class);

    private final NotificationDeliveryRepository deliveries;
    private final NotificationRepository notifications;
    private final NotificationRecipientDirectory directory;
    private final NotificationChannelRegistry registry;
    private final NotificationTemplateService templates;
    private final NotificationProperties properties;
    private final AuditService audit;
    private final Clock clock;

    public NotificationDeliveryAttemptService(NotificationDeliveryRepository deliveries,
                                               NotificationRepository notifications,
                                               NotificationRecipientDirectory directory,
                                               NotificationChannelRegistry registry,
                                               NotificationTemplateService templates,
                                               NotificationProperties properties,
                                               AuditService audit,
                                               Clock clock) {
        this.deliveries = deliveries;
        this.notifications = notifications;
        this.directory = directory;
        this.registry = registry;
        this.templates = templates;
        this.properties = properties;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public boolean attempt(UUID deliveryId) {
        Instant now = clock.instant();
        NotificationDelivery delivery = deliveries.findByIdForUpdate(deliveryId).orElse(null);
        if (delivery == null || !delivery.isDue(now)) {
            return false;
        }
        Optional<NotificationChannelAdapter> adapter = registry.enabled(delivery.getChannel());
        if (adapter.isEmpty()) {
            // The provider was switched off after this row was queued. Leave it pending rather
            // than burning its retry budget; an operator can re-enable the provider or retry.
            return false;
        }

        Optional<Notification> notification = notifications.findById(delivery.getNotificationId());
        if (notification.isEmpty()) {
            fail(delivery, now, "Notification no longer exists");
            return false;
        }
        Optional<NotificationRecipientDirectory.Recipient> recipient =
                directory.find(delivery.getRecipientUserId());
        String destination = recipient.map(r -> destination(delivery.getChannel(), r)).orElse(null);
        if (recipient.isEmpty() || destination == null || destination.isBlank()
                || !enabled(delivery.getChannel(), recipient.get())) {
            fail(delivery, now, "No deliverable " + delivery.getChannel() + " destination");
            return false;
        }

        NotificationTemplateService.Rendered rendered = templates.render(notification.get());
        OutboundNotification message = new OutboundNotification(
                delivery.getId(), delivery.getChannel(), delivery.getRecipientUserId(), destination,
                delivery.getDestinationMasked(), rendered.subject(),
                delivery.getChannel() == NotificationChannel.EMAIL ? rendered.emailBody() : rendered.smsBody(),
                notification.get().getEntityType(), notification.get().getEntityId());

        try {
            adapter.get().send(message);
            delivery.markSent(now, adapter.get().providerName());
            audit.recordAs(null, "system", "NOTIFICATION_DELIVERY_SENT", "NotificationDelivery",
                    delivery.getId(), details(delivery));
            return true;
        } catch (RuntimeException e) {
            fail(delivery, now, safeError(e));
            return false;
        }
    }

    private void fail(NotificationDelivery delivery, Instant now, String error) {
        delivery.markFailed(now, error, properties.retry().baseBackoffMs(), properties.retry().maxBackoffMs());
        String action = delivery.getStatus() == DeliveryStatus.FAILED
                ? "NOTIFICATION_DELIVERY_FAILED" : "NOTIFICATION_DELIVERY_RETRY";
        audit.recordAs(null, "system", action, "NotificationDelivery", delivery.getId(), details(delivery));
        log.warn("{} delivery {} for notification {} failed (attempt {}/{}): {}", delivery.getChannel(),
                delivery.getId(), delivery.getNotificationId(), delivery.getAttempts(),
                delivery.getMaxAttempts(), error);
    }

    private static String details(NotificationDelivery delivery) {
        return "channel=" + delivery.getChannel() + " to=" + delivery.getDestinationMasked()
                + " attempt=" + delivery.getAttempts() + " status=" + delivery.getStatus()
                + (delivery.getLastError() == null ? "" : " error=" + delivery.getLastError());
    }

    private static String safeError(RuntimeException e) {
        if (e instanceof NotificationDeliveryException && e.getMessage() != null) {
            return e.getMessage();
        }
        return "unexpected " + e.getClass().getSimpleName();
    }

    private static String destination(NotificationChannel channel, NotificationRecipientDirectory.Recipient recipient) {
        return channel == NotificationChannel.EMAIL ? recipient.email() : recipient.phone();
    }

    private static boolean enabled(NotificationChannel channel, NotificationRecipientDirectory.Recipient recipient) {
        return channel == NotificationChannel.EMAIL ? recipient.emailEnabled() : recipient.smsEnabled();
    }
}
