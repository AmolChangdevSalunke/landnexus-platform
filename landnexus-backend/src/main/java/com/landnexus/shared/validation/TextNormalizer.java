package com.landnexus.shared.validation;

import java.util.Locale;

/** Small helpers so codes, names and logins are stored in one consistent form. */
public final class TextNormalizer {

    private TextNormalizer() {
    }

    /** Codes are stored trimmed and upper-case, e.g. " mh " becomes "MH". */
    public static String code(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    /** Names are trimmed and inner whitespace is collapsed. */
    public static String name(String value) {
        return value == null ? null : value.trim().replaceAll("\\s+", " ");
    }

    /** Usernames are case-insensitive: stored trimmed and lower-case. */
    public static String username(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    /** Email addresses are stored trimmed and lower-case. */
    public static String email(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }
}
