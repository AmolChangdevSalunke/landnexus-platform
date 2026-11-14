package com.landnexus.shared.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Development adapter: prints the message to the application log instead of calling a provider.
 * It must be selected explicitly with provider=log and is never active by default.
 */
public class LogNotificationAdapter implements NotificationChannelAdapter {

    private static final Logger log = LoggerFactory.getLogger(LogNotificationAdapter.class);

    private final NotificationChannel channel;

    public LogNotificationAdapter(NotificationChannel channel) {
        this.channel = channel;
    }

    @Override
    public NotificationChannel channel() {
        return channel;
    }

    @Override
    public String providerName() {
        return "log";
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public void send(OutboundNotification notification) {
        log.info("DEV {} notification to {} (delivery {}): {} | {}",
                channel, notification.maskedDestination(), notification.deliveryId(),
                notification.subject(), notification.body());
    }
}
