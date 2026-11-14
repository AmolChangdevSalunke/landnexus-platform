package com.landnexus.shared.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class HttpNotificationAdapterTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void emailPayload_containsProviderNeutralFieldsAndAnOptionalBearerToken() throws Exception {
        AtomicReference<String> body = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        String endpoint = start(exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            exchange.sendResponseHeaders(202, -1);
            exchange.close();
        });
        HttpNotificationAdapter adapter = new HttpNotificationAdapter(NotificationChannel.EMAIL, endpoint,
                "secret-token", "no-reply@landnexus.local", 5, mapper);

        adapter.send(message(NotificationChannel.EMAIL, "john@example.com", "j***e@example.com", "Subject", "Body"));

        JsonNode json = mapper.readTree(body.get());
        assertThat(json.get("to").asText()).isEqualTo("john@example.com");
        assertThat(json.get("from").asText()).isEqualTo("no-reply@landnexus.local");
        assertThat(json.get("subject").asText()).isEqualTo("Subject");
        assertThat(json.get("text").asText()).isEqualTo("Body");
        assertThat(authorization.get()).isEqualTo("Bearer secret-token");
    }

    @Test
    void smsPayload_usesSenderAndMessage() throws Exception {
        AtomicReference<String> body = new AtomicReference<>();
        String endpoint = start(exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        HttpNotificationAdapter adapter = new HttpNotificationAdapter(NotificationChannel.SMS, endpoint,
                "", "LANDNEXUS", 5, mapper);

        adapter.send(message(NotificationChannel.SMS, "+919876543210", "******3210", "Subject", "Body"));

        JsonNode json = mapper.readTree(body.get());
        assertThat(json.get("to").asText()).isEqualTo("+919876543210");
        assertThat(json.get("sender").asText()).isEqualTo("LANDNEXUS");
        assertThat(json.get("message").asText()).isEqualTo("Body");
        assertThat(json.has("subject")).isFalse();
    }

    @Test
    void aNon2xxResponse_isADeliveryFailure() throws Exception {
        String endpoint = start(exchange -> {
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });
        HttpNotificationAdapter adapter = new HttpNotificationAdapter(NotificationChannel.EMAIL, endpoint,
                "", "no-reply@landnexus.local", 5, mapper);

        assertThatThrownBy(() -> adapter.send(message(NotificationChannel.EMAIL, "a@b.test", "a***@b.test", "s", "b")))
                .isInstanceOf(NotificationDeliveryException.class)
                .hasMessageContaining("HTTP 500");
    }

    @Test
    void anHttpProviderWithoutAWebhookUrl_failsAtStartup() {
        assertThatThrownBy(() -> new HttpNotificationAdapter(NotificationChannel.EMAIL, "", "", "", 5, mapper))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("webhook-url is required");
    }

    @Test
    void anInvalidWebhookUrl_failsAtStartup() {
        assertThatThrownBy(() -> new HttpNotificationAdapter(NotificationChannel.SMS, "not a url", "", "", 5, mapper))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not a valid absolute URL");
    }

    private String start(com.sun.net.httpserver.HttpHandler handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/notify", handler);
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/notify";
    }

    private static OutboundNotification message(NotificationChannel channel, String destination,
                                                 String masked, String subject, String body) {
        return new OutboundNotification(UUID.randomUUID(), channel, UUID.randomUUID(), destination, masked,
                subject, body, "Proposal", UUID.randomUUID());
    }
}
