package com.landnexus.shared.logging;

import org.slf4j.Logger;
import org.slf4j.Marker;
import org.slf4j.MarkerFactory;

/**
 * Small helpers for events that need an explicit severity outside SLF4J's five levels.
 * SLF4J has no FATAL level, so a FATAL marker is attached to an ERROR event: it remains visible in the
 * console ({@code %marker}) and in the JSON file's {@code markers} field, and alerting can key on it.
 */
public final class Log {

    public static final Marker FATAL = MarkerFactory.getMarker("FATAL");

    private Log() {
    }

    public static void fatal(Logger logger, String message, Throwable throwable) {
        logger.error(FATAL, message, throwable);
    }

    public static void fatal(Logger logger, String message) {
        logger.error(FATAL, message);
    }
}
