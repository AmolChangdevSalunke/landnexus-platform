package com.landnexus.shared.logging;

import java.util.regex.Pattern;

/**
 * Makes a log value safe before it reaches a console, file or JSON sink. Logging must never become a way to leak
 * credentials or forge extra lines, so control characters are removed and common secret spellings are redacted.
 * This is deliberately defensive: messages should still avoid carrying secrets in the first place.
 */
public final class LogSanitizer {

    static final int MAX_LENGTH = 500;

    private static final Pattern SECRET_ASSIGNMENT = Pattern.compile(
            "(?i)(token|password|passwd|secret|api[_-]?key|authorization|refresh[_-]?token|access[_-]?token)"
                    + "\\s*[=:]\\s*[^\\s,;&]+");
    private static final Pattern BEARER = Pattern.compile("(?i)bearer\\s+[A-Za-z0-9._~+/=-]+");
    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}");
    private static final Pattern EMAIL = Pattern.compile("([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\\.[A-Za-z]{2,})");

    private LogSanitizer() {
    }

    public static String safe(String value) {
        if (value == null) {
            return "";
        }
        String cleaned = value.replaceAll("[\\r\\n\\t\\u0000-\\u001F\\u007F]", " ").replaceAll("\\s+", " ").trim();
        // Bearer/JWT shapes first: otherwise the generic "Authorization: ..." rule stops at the space after
        // "Bearer" and leaves the credential itself in the message.
        cleaned = BEARER.matcher(cleaned).replaceAll("Bearer [REDACTED]");
        cleaned = JWT.matcher(cleaned).replaceAll("[REDACTED_JWT]");
        cleaned = SECRET_ASSIGNMENT.matcher(cleaned).replaceAll("$1=[REDACTED]");
        cleaned = EMAIL.matcher(cleaned).replaceAll("$1***$2");
        return cleaned.length() > MAX_LENGTH ? cleaned.substring(0, MAX_LENGTH) : cleaned;
    }

    public static String path(String value) {
        if (value == null || value.isBlank()) {
            return "/";
        }
        String cleaned = value.replaceAll("[\\r\\n\\t\\u0000-\\u001F\\u007F]", "");
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }

    /** Usernames are personal data; keep only enough to correlate a support case. */
    public static String username(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        String clean = safe(value);
        return clean.length() <= 2 ? clean.charAt(0) + "***"
                : clean.charAt(0) + "***" + clean.charAt(clean.length() - 1);
    }
}
