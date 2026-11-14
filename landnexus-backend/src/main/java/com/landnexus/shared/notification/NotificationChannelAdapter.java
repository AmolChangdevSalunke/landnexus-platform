package com.landnexus.shared.notification;

/**
 * A provider adapter for one external channel. Adapters are deliberately small: they translate
 * an {@link OutboundNotification} into a provider call and throw {@link NotificationDeliveryException}
 * on failure. Retry, status and audit handling stay in the dispatcher.
 */
public interface NotificationChannelAdapter {

    NotificationChannel channel();

    /** The configured provider name, stored on successful delivery records. */
    String providerName();

    /** False when the provider is "none"; such an adapter is never called. */
    boolean enabled();

    void send(OutboundNotification notification) throws NotificationDeliveryException;
}
