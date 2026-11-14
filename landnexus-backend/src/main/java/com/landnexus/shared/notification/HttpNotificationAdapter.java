package com.landnexus.shared.notification;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * Sends a notification to a configured HTTP webhook. The payload is deliberately provider-neutral
 * ({@code to/from/subject/text} for e-mail, {@code to/sender/message} for SMS) so an operator can
 * put a small gateway in front of any e-mail or SMS vendor without changing the application.
 */
public class HttpNotificationAdapter implements NotificationChannelAdapter {

    private final NotificationChannel channel;
    private final String endpoint;
    private final String token;
    private final String sender;
    private final Duration timeout;
    private final ObjectMapper mapper;
    private final HttpClient client;

    public HttpNotificationAdapter(NotificationChannel channel, String endpoint, String token,
                                   String sender, int timeoutSeconds, ObjectMapper mapper) {
        this.channel = channel;
        this.endpoint = requireEndpoint(channel, endpoint);
        this.token = token;
        this.sender = sender;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.mapper = mapper;
        this.client = HttpClient.newBuilder().connectTimeout(this.timeout).build();
    }

    @Override
    public NotificationChannel channel() {
        return channel;
    }

    @Override
    public String providerName() {
        return "http";
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public void send(OutboundNotification notification) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .header("X-LandNexus-Channel", channel.name())
                .POST(HttpRequest.BodyPublishers.ofString(payload(notification)));
        if (token != null && !token.isBlank()) {
            builder.header("Authorization", "Bearer " + token);
        }
        HttpRequest request = builder.build();
        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new NotificationDeliveryException("provider returned HTTP " + response.statusCode());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new NotificationDeliveryException("provider call was interrupted", e);
        } catch (IOException e) {
            throw new NotificationDeliveryException("provider call failed: " + e.getClass().getSimpleName(), e);
        }
    }

    private String payload(OutboundNotification notification) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("to", notification.destination());
        if (channel == NotificationChannel.EMAIL) {
            body.put("from", sender);
            body.put("subject", notification.subject());
            body.put("text", notification.body());
        } else {
            body.put("sender", sender);
            body.put("message", notification.body());
        }
        if (notification.entityType() != null) {
            body.put("entityType", notification.entityType());
        }
        if (notification.entityId() != null) {
            body.put("entityId", notification.entityId().toString());
        }
        try {
            return mapper.writeValueAsString(body);
        } catch (JacksonException e) {
            throw new NotificationDeliveryException("could not serialize provider payload", e);
        }
    }

    private static String requireEndpoint(NotificationChannel channel, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            throw new IllegalStateException("landnexus.notifications." + channel.name().toLowerCase()
                    + ".webhook-url is required when the provider is http");
        }
        try {
            URI uri = URI.create(endpoint);
            if (uri.getScheme() == null || uri.getHost() == null) {
                throw new IllegalArgumentException("not an absolute URL");
            }
            return endpoint;
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("landnexus.notifications." + channel.name().toLowerCase()
                    + ".webhook-url is not a valid absolute URL", e);
        }
    }
}
