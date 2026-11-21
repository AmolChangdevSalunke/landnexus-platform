package com.landnexus.shared.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the outbox dispatcher on a timer. It is safe to leave enabled when no provider is
 * configured: with provider=none no delivery rows are ever written.
 */
@Component
@ConditionalOnProperty(name = "landnexus.notifications.dispatch-enabled", havingValue = "true", matchIfMissing = true)
public class NotificationDispatchScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatchScheduler.class);

    private final NotificationDispatcher dispatcher;

    public NotificationDispatchScheduler(NotificationDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @Scheduled(initialDelayString = "${landnexus.notifications.dispatch-initial-delay-ms:15000}",
            fixedDelayString = "${landnexus.notifications.dispatch-interval-ms:5000}")
    public void run() {
        long started = System.nanoTime();
        try {
            int sent = dispatcher.dispatchDue();
            if (sent > 0) {
                log.info("Notification dispatcher sent {} message(s) ({} ms)", sent,
                        (System.nanoTime() - started) / 1_000_000L);
            } else {
                log.trace("Notification dispatch cycle found nothing to send ({} ms)",
                        (System.nanoTime() - started) / 1_000_000L);
            }
        } catch (RuntimeException e) {
            log.error("Notification dispatch cycle failed after {} ms",
                    (System.nanoTime() - started) / 1_000_000L, e);
        }
    }
}
