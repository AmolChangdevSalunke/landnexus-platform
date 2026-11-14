package com.landnexus.shared.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * External notification settings. Providers default to "none", so no e-mail or SMS leaves the
 * machine until an operator explicitly configures one. The dev/test "log" provider writes to
 * the application log and never contacts a network service.
 */
@ConfigurationProperties(prefix = "landnexus.notifications")
public record NotificationProperties(String linkBaseUrl, Email email, Sms sms, Retry retry) {

    public NotificationProperties {
        linkBaseUrl = linkBaseUrl == null ? "" : linkBaseUrl.trim();
        email = email == null ? new Email("none", "no-reply@landnexus.local", "", "", 10) : email;
        sms = sms == null ? new Sms("none", "LANDNEXUS", "", "", 10) : sms;
        retry = retry == null ? new Retry(5, 30_000L, 3_600_000L) : retry;
    }

    public record Email(String provider, String from, String webhookUrl, String token, int timeoutSeconds) {
        public Email {
            provider = normalizeProvider(provider);
            from = blankTo(from, "no-reply@landnexus.local");
            webhookUrl = blankTo(webhookUrl, "");
            token = blankTo(token, "");
            timeoutSeconds = timeoutSeconds <= 0 ? 10 : timeoutSeconds;
        }
    }

    public record Sms(String provider, String senderId, String webhookUrl, String token, int timeoutSeconds) {
        public Sms {
            provider = normalizeProvider(provider);
            senderId = blankTo(senderId, "LANDNEXUS");
            webhookUrl = blankTo(webhookUrl, "");
            token = blankTo(token, "");
            timeoutSeconds = timeoutSeconds <= 0 ? 10 : timeoutSeconds;
        }
    }

    public record Retry(int maxAttempts, long baseBackoffMs, long maxBackoffMs) {
        public Retry {
            maxAttempts = maxAttempts <= 0 ? 5 : maxAttempts;
            baseBackoffMs = baseBackoffMs <= 0 ? 30_000L : baseBackoffMs;
            maxBackoffMs = maxBackoffMs < baseBackoffMs ? baseBackoffMs : maxBackoffMs;
        }
    }

    private static String normalizeProvider(String value) {
        return value == null || value.isBlank() ? "none" : value.trim().toLowerCase();
    }

    private static String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
