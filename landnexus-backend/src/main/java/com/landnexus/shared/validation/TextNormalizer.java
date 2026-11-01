package com.landnexus.shared.validation;

import java.util.Locale;

/** Small helpers so codes and names are stored in one consistent form. */
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
}
