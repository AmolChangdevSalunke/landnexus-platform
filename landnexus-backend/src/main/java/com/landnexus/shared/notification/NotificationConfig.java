package com.landnexus.shared.notification;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import tools.jackson.databind.ObjectMapper;

/**
 * Builds one adapter per external channel from configuration. Unknown provider names fail at
 * startup instead of silently discarding notifications. dispatch-enabled only controls the
 * scheduled worker; the outbox is always safe to write to.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@EnableConfigurationProperties(NotificationProperties.class)
public class NotificationConfig {

    @Bean
    public NotificationChannelAdapter emailNotificationAdapter(NotificationProperties properties, ObjectMapper mapper) {
        NotificationProperties.Email email = properties.email();
        return switch (email.provider()) {
            case "none" -> new DisabledNotificationAdapter(NotificationChannel.EMAIL);
            case "log" -> new LogNotificationAdapter(NotificationChannel.EMAIL);
            case "http" -> new HttpNotificationAdapter(NotificationChannel.EMAIL, email.webhookUrl(),
                    email.token(), email.from(), email.timeoutSeconds(), mapper);
            default -> throw new IllegalStateException(
                    "Unknown e-mail notification provider: " + email.provider() + " (use none, log or http)");
        };
    }

    @Bean
    public NotificationChannelAdapter smsNotificationAdapter(NotificationProperties properties, ObjectMapper mapper) {
        NotificationProperties.Sms sms = properties.sms();
        return switch (sms.provider()) {
            case "none" -> new DisabledNotificationAdapter(NotificationChannel.SMS);
            case "log" -> new LogNotificationAdapter(NotificationChannel.SMS);
            case "http" -> new HttpNotificationAdapter(NotificationChannel.SMS, sms.webhookUrl(),
                    sms.token(), sms.senderId(), sms.timeoutSeconds(), mapper);
            default -> throw new IllegalStateException(
                    "Unknown SMS notification provider: " + sms.provider() + " (use none, log or http)");
        };
    }
}
