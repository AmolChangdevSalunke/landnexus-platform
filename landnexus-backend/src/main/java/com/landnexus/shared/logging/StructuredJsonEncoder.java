package com.landnexus.shared.logging;

import ch.qos.logback.classic.encoder.JsonEncoder;
import ch.qos.logback.classic.spi.ILoggingEvent;
import java.time.Instant;

/**
 * Logback's built-in {@link JsonEncoder} plus two stable top-level fields that every operational log search
 * expects: {@code service} and {@code environment}. Request-scoped values (requestId, userId, method, path)
 * are already emitted in the encoder's {@code mdc} object by the request filters.
 */
public class StructuredJsonEncoder extends JsonEncoder {

    private String service = "landnexus";
    private String environment = "dev";

    public void setService(String service) {
        this.service = service;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    @Override
    protected void appendCustomFields(StringBuilder builder, ILoggingEvent event) {
        // ISO-8601 UTC is easier for log tools than the encoder's numeric epoch timestamp, which is disabled in XML.
        builder.append(",\"timestamp\":\"").append(escape(Instant.ofEpochMilli(event.getTimeStamp()).toString()))
                .append("\",\"service\":\"").append(escape(service))
                .append("\",\"environment\":\"").append(escape(environment)).append('"');
        super.appendCustomFields(builder, event);
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder safe = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> safe.append("\\\"");
                case '\\' -> safe.append("\\\\");
                default -> {
                    if (c >= 0x20) {
                        safe.append(c);
                    }
                }
            }
        }
        return safe.toString();
    }
}
