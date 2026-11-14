package com.landnexus.shared.notification;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * Finds due outbox rows and sends them one by one in short transactions. The provider call never
 * runs inside the transaction that created the in-app notification.
 */
@Service
public class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);
    private static final int BATCH_SIZE = 25;

    private final NotificationDeliveryRepository deliveries;
    private final NotificationDeliveryAttemptService attempts;
    private final Clock clock;

    public NotificationDispatcher(NotificationDeliveryRepository deliveries,
                                  NotificationDeliveryAttemptService attempts, Clock clock) {
        this.deliveries = deliveries;
        this.attempts = attempts;
        this.clock = clock;
    }

    /** Sends at most one bounded batch. Returns how many messages were accepted by a provider. */
    public int dispatchDue() {
        Instant now = clock.instant();
        List<UUID> due = deliveries.findDueIds(
                List.of(DeliveryStatus.PENDING, DeliveryStatus.RETRY), now, PageRequest.of(0, BATCH_SIZE));
        int sent = 0;
        for (UUID id : due) {
            try {
                if (attempts.attempt(id)) {
                    sent++;
                }
            } catch (RuntimeException e) {
                // One bad row must not stop the rest of the batch. The row keeps its status.
                log.error("Unexpected failure while dispatching delivery {}", id, e);
            }
        }
        return sent;
    }
}
