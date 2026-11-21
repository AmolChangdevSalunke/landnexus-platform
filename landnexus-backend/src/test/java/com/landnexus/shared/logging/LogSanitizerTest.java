package com.landnexus.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LogSanitizerTest {

    @Test
    void removesControlCharactersSoValuesCannotForgeLines() {
        String cleaned = LogSanitizer.safe("alice\r\nINFO fake log line\u0000");

        assertThat(cleaned).isEqualTo("alice INFO fake log line");
        assertThat(cleaned).doesNotContain("\n", "\r", "\u0000");
    }

    @Test
    void redactsAssignmentsAndBearerTokens() {
        String cleaned = LogSanitizer.safe(
                "token=abc123 password: hunter2 api_key=xyz Authorization: Bearer abc.def.ghi");

        assertThat(cleaned).doesNotContain("abc123", "hunter2", "xyz", "abc.def.ghi");
        assertThat(cleaned).contains("[REDACTED]");
    }

    @Test
    void redactsJwtShapedValues() {
        String cleaned = LogSanitizer.safe("jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123");

        assertThat(cleaned).doesNotContain("eyJhbGciOiJIUzI1NiJ9");
        assertThat(cleaned).contains("[REDACTED_JWT]");
    }

    @Test
    void masksEmailLocalPartAndLongUsernames() {
        assertThat(LogSanitizer.safe("contact alice.smith@example.com")).contains("a***@example.com");
        assertThat(LogSanitizer.username("alice")).isEqualTo("a***e");
        assertThat(LogSanitizer.username("ab")).isEqualTo("a***");
        assertThat(LogSanitizer.username(null)).isEqualTo("unknown");
    }

    @Test
    void truncatesVeryLongValuesAndKeepsPathsUseful() {
        String longValue = "x".repeat(LogSanitizer.MAX_LENGTH + 50);

        assertThat(LogSanitizer.safe(longValue)).hasSize(LogSanitizer.MAX_LENGTH);
        assertThat(LogSanitizer.path("/api/v1/projects\r\nINFO forged")).isEqualTo("/api/v1/projectsINFO forged");
        assertThat(LogSanitizer.path(null)).isEqualTo("/");
    }
}
