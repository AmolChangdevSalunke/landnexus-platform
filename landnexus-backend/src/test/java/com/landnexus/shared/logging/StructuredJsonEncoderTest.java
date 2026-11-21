package com.landnexus.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class StructuredJsonEncoderTest {

    private final LoggerContext context = new LoggerContext();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void emitsStructuredJsonWithServiceEnvironmentAndMdc() {
        Logger logger = context.getLogger("com.landnexus.administration.api.AuthController");
        MDC.put(RequestLoggingFilter.REQUEST_ID, "req-123");
        MDC.put(RequestLoggingFilter.USER_ID, "u***1");
        LoggingEvent event = new LoggingEvent(logger.getName(), logger, Level.INFO,
                "Login succeeded for user {}", null, new Object[]{"user-1"});
        event.setThreadName("test-thread");
        event.setMDCPropertyMap(Map.of(RequestLoggingFilter.REQUEST_ID, "req-123",
                RequestLoggingFilter.USER_ID, "u***1"));

        StructuredJsonEncoder encoder = new StructuredJsonEncoder();
        encoder.setContext(context);
        encoder.setService("landnexus");
        encoder.setEnvironment("prod");
        encoder.setWithFormattedMessage(true);
        encoder.setWithTimestamp(false);
        encoder.start();
        String json = new String(encoder.encode(event), StandardCharsets.UTF_8);

        JsonNode node = new ObjectMapper().readTree(json);
        assertThat(node.path("timestamp").asText()).matches("\\d{4}-\\d{2}-\\d{2}T.*Z");
        assertThat(node.path("level").asText()).isEqualTo("INFO");
        assertThat(node.path("formattedMessage").asText()).isEqualTo("Login succeeded for user user-1");
        assertThat(node.path("threadName").asText()).isNotBlank();
        assertThat(node.path("loggerName").asText()).contains("AuthController");
        assertThat(node.path("service").asText()).isEqualTo("landnexus");
        assertThat(node.path("environment").asText()).isEqualTo("prod");
        assertThat(node.path("mdc").path("requestId").asText()).isEqualTo("req-123");
        assertThat(node.path("mdc").path("userId").asText()).isEqualTo("u***1");
        encoder.stop();
    }

    @Test
    void includesThrowableDetailsForErrors() {
        Logger logger = context.getLogger("com.landnexus.shared.exception.ApiExceptionHandler");
        LoggingEvent event = new LoggingEvent(logger.getName(), logger, Level.ERROR,
                "Database error", new IllegalStateException("connection refused"), new Object[0]);
        event.setMDCPropertyMap(Map.of());

        StructuredJsonEncoder encoder = new StructuredJsonEncoder();
        encoder.setContext(context);
        encoder.setEnvironment("dev");
        encoder.setWithFormattedMessage(true);
        encoder.setWithTimestamp(false);
        encoder.start();
        String json = new String(encoder.encode(event), StandardCharsets.UTF_8);

        assertThat(json).contains("\"throwable\"").contains("connection refused");
        assertThat(json).contains("\"service\":\"landnexus\"").contains("\"environment\":\"dev\"");
        encoder.stop();
    }
}
