package com.landnexus.shared.notification;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional outbox for external channels.
 *
 * <p>{@link #enqueue(Notification)} is called in the same transaction as the in-app notification.
 * It only writes rows; no network call happens here. That keeps approval and other business
 * transactions fast and makes the notification atomic with the business change: if the
 * transaction rolls back, no delivery row survives.
 */
@Service
public class NotificationOutbox {

    private static final Logger log = LoggerFactory.getLogger(NotificationOutbox.class);
    private static final List<NotificationChannel> EXTERNAL =
            List.of(NotificationChannel.EMAIL, NotificationChannel.SMS);

    private final NotificationDeliveryRepository deliveries;
    private final NotificationRecipientDirectory directory;
    private final NotificationChannelRegistry registry;
    private final NotificationProperties properties;
    private final Clock clock;

    public NotificationOutbox(NotificationDeliveryRepository deliveries, NotificationRecipientDirectory directory,
                              NotificationChannelRegistry registry, NotificationProperties properties, Clock clock) {
        this.deliveries = deliveries;
        this.directory = directory;
        this.registry = registry;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public int enqueue(Notification notification) {
        if (notification.getId() == null) {
            throw new IllegalStateException("Notification must be saved before it can be enqueued");
        }
        int created = 0;
        Instant now = clock.instant();
        for (NotificationChannel channel : EXTERNAL) {
            if (registry.enabled(channel).isEmpty()) {
                continue;
            }
            NotificationRecipientDirectory.Recipient recipient =
                    directory.find(notification.getRecipientUserId()).orElse(null);
            if (recipient == null) {
                continue;
            }
            String destination = destination(channel, recipient);
            if (destination == null || destination.isBlank() || !enabled(channel, recipient)) {
                continue;
            }
            // The unique (notification_id, channel) constraint is the final duplicate guard;
            // this check makes the common case an ordinary no-op.
            if (deliveries.existsByNotificationIdAndChannel(notification.getId(), channel)) {
                continue;
            }
            String masked = channel == NotificationChannel.EMAIL
                    ? ContactMasker.email(destination)
                    : ContactMasker.phone(destination);
            String dedupeKey = notification.getId() + ":" + channel.name();
            deliveries.save(new NotificationDelivery(notification.getId(), notification.getRecipientUserId(),
                    channel, masked, properties.retry().maxAttempts(), dedupeKey, now));
            created++;
        }
        if (created > 0) {
            log.debug("Enqueued {} external delivery row(s) for notification {}", created, notification.getId());
        }
        return created;
    }

    private static String destination(NotificationChannel channel, NotificationRecipientDirectory.Recipient recipient) {
        return channel == NotificationChannel.EMAIL ? recipient.email() : recipient.phone();
    }

    private static boolean enabled(NotificationChannel channel, NotificationRecipientDirectory.Recipient recipient) {
        return channel == NotificationChannel.EMAIL ? recipient.emailEnabled() : recipient.smsEnabled();
    }
}
