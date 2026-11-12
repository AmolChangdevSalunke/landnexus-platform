package com.landnexus.support;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Base for integration tests that must run ONLY against an explicitly provided disposable PostgreSQL database.
 * Safety: fails fast if the datasource would target the configured development database (landnexus_dev) or if
 * no isolated test database URL is provided. Never falls back to the normal development datasource.
 *
 * Provide a dedicated disposable database via:
 *   LANDNEXUS_TEST_DB_URL (or DB_URL), LANDNEXUS_TEST_DB_USERNAME (or DB_USERNAME), LANDNEXUS_TEST_DB_PASSWORD (or DB_PASSWORD)
 * Optionally JWT/other required app secrets via environment variables as usual.
 */
public abstract class AbstractIsolatedPgIntegrationTest {

    protected static final String DEV_DB_URL = "jdbc:postgresql://localhost:5432/landnexus_dev";
    protected static final String DEV_DB_NAME = "landnexus_dev";

    @DynamicPropertySource
    static void registerIsolatedDatasource(DynamicPropertyRegistry registry) {
        String url = firstNonBlank(System.getenv("LANDNEXUS_TEST_DB_URL"), System.getenv("DB_URL"));
        String username = firstNonBlank(System.getenv("LANDNEXUS_TEST_DB_USERNAME"), System.getenv("DB_USERNAME"));
        String password = firstNonBlank(System.getenv("LANDNEXUS_TEST_DB_PASSWORD"), System.getenv("DB_PASSWORD"));

        if (isBlank(url) || isBlank(username) || isBlank(password)) {
            throw new IllegalStateException("Isolated PostgreSQL integration test refused to start: provide a dedicated disposable test database "
                    + "via LANDNEXUS_TEST_DB_URL/DB_URL, LANDNEXUS_TEST_DB_USERNAME/DB_USERNAME, LANDNEXUS_TEST_DB_PASSWORD/DB_PASSWORD. "
                    + "Tests must never use landnexus_dev.");
        }
        if (isDevDatabase(url)) {
            throw new IllegalStateException("Isolated PostgreSQL integration test refused to start: datasource URL targets the development database "
                    + "(landnexus_dev). Provide a separately named disposable PostgreSQL database. URL=" + sanitizeUrl(url));
        }

        // Force isolated datasource and ensure Spring never replaces it.
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> username);
        registry.add("spring.datasource.password", () -> password);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.test.database.replace", () -> "NONE");
    }

    @BeforeAll
    static void verifyNotDevDatabase() {
        String url = firstNonBlank(System.getenv("LANDNEXUS_TEST_DB_URL"), System.getenv("DB_URL"));
        if (isDevDatabase(url)) {
            throw new IllegalStateException("Refusing to run: configured test datasource resolves to development database landnexus_dev.");
        }
    }

    protected static void assumeIsolatedDbAvailable() {
        String url = firstNonBlank(System.getenv("LANDNEXUS_TEST_DB_URL"), System.getenv("DB_URL"));
        Assumptions.assumeFalse(isBlank(url), "Isolated PostgreSQL test database not configured; skipping real PostgreSQL integration test.");
    }

    protected static boolean isDevDatabase(String url) {
        if (isBlank(url)) return false;
        String normalized = url.trim().toLowerCase();
        return normalized.equals(DEV_DB_URL) || normalized.contains("/landnexus_dev") || normalized.contains("landnexus_dev?");
    }

    protected static String sanitizeUrl(String url) {
        if (url == null) return "null";
        int q = url.indexOf('?');
        return q >= 0 ? url.substring(0, q) : url;
    }

    private static String firstNonBlank(String a, String b) {
        if (!isBlank(a)) return a;
        if (!isBlank(b)) return b;
        return null;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
