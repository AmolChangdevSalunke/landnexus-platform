package com.landnexus.shared.logging;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.Duration;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationFailedEvent;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Writes the few lifecycle lines an operator needs (started, shutting down, failed to start) and one
 * connectivity check. Database credentials are never read or logged; only the product name is recorded.
 */
@Component
public class ApplicationLifecycleLogger {

    private static final Logger log = LoggerFactory.getLogger(ApplicationLifecycleLogger.class);

    private final Environment environment;
    private final DataSource dataSource;

    public ApplicationLifecycleLogger(Environment environment, DataSource dataSource) {
        this.environment = environment;
        this.dataSource = dataSource;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady(ApplicationReadyEvent event) {
        String profiles = environment.getActiveProfiles().length == 0
                ? "default" : String.join(",", environment.getActiveProfiles());
        Duration took = event.getTimeTaken();
        log.info("Started landnexus in {} ms (profiles: {}, java: {}, pid: {})",
                took == null ? "?" : took.toMillis(), profiles, System.getProperty("java.version"), ProcessHandle.current().pid());
        logDatabase();
    }

    @EventListener(ContextClosedEvent.class)
    public void onShutdown(ContextClosedEvent event) {
        log.info("Shutting down landnexus (uptime: {} s)", Management.uptimeSeconds());
    }

    @EventListener(ApplicationFailedEvent.class)
    public void onFailed(ApplicationFailedEvent event) {
        Log.fatal(log, "landnexus failed to start", event.getException());
    }

    private void logDatabase() {
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData meta = connection.getMetaData();
            log.info("Database connection established: {} {} (read-only: {})",
                    meta.getDatabaseProductName(), meta.getDatabaseProductVersion(), connection.isReadOnly());
        } catch (Exception ex) {
            // Startup must continue; the API will surface real database failures when a repository is used.
            log.warn("Database connectivity check failed: {}", LogSanitizer.safe(ex.getMessage()));
        }
    }

    /** Kept package-private for a deterministic test hook; normal operation reads the JVM start time. */
    static final class Management {
        private static final long STARTED_AT = System.currentTimeMillis();

        private Management() {
        }

        static long uptimeSeconds() {
            return Math.max(0, (System.currentTimeMillis() - STARTED_AT) / 1000);
        }
    }
}
