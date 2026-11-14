package com.landnexus.shared.notification;

/** An adapter that is wired but switched off. It is never called by the dispatcher. */
public class DisabledNotificationAdapter implements NotificationChannelAdapter {

    private final NotificationChannel channel;

    public DisabledNotificationAdapter(NotificationChannel channel) {
        this.channel = channel;
    }

    @Override
    public NotificationChannel channel() {
        return channel;
    }

    @Override
    public String providerName() {
        return "none";
    }

    @Override
    public boolean enabled() {
        return false;
    }

    @Override
    public void send(OutboundNotification notification) {
        throw new NotificationDeliveryException(channel + " provider is not configured");
    }
}
