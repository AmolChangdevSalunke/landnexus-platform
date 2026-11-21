package com.landnexus.gis.bhuvan;

import java.net.URI;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Where the ISRO Bhuvan API lives and how it is reached. The access token is a backend-only secret: it is never
 * returned by an endpoint, never written to a log and never sent to the browser.
 */
public record BhuvanConfig(boolean enabled, String baseUrl, String token, int timeoutSeconds, int maxBytes,
                           Set<String> villageDocumentedStates, boolean maharashtraVillageVerified) {

    /** The Bhuvan documentation currently names Andhra Pradesh and Karnataka for village geocoding. */
    public static final Set<String> DEFAULT_VILLAGE_STATES = Set.of("AP", "KA");

    public boolean tokenConfigured() {
        return token != null && !token.isBlank();
    }

    /**
     * Village lookup is refused for Maharashtra until an operator records a successful Maharashtra check. The public
     * Bhuvan documentation for these two endpoints mentions only Andhra Pradesh and Karnataka.
     */
    public boolean villageLookupAllowedFor(String stateCode) {
        if (!enabled || !tokenConfigured()) {
            return false;
        }
        String code = stateCode == null ? "" : stateCode.trim().toUpperCase(Locale.ROOT);
        if (code.isEmpty()) {
            return true;
        }
        if (!villageDocumentedStates.contains(code)) {
            return false;
        }
        return !"MH".equals(code) || maharashtraVillageVerified;
    }

    public void validate() {
        if (!enabled) {
            return;
        }
        if (!tokenConfigured()) {
            throw new IllegalStateException("Bhuvan is enabled but BHUVAN_API_TOKEN is empty");
        }
        URI uri;
        try {
            uri = URI.create(baseUrl);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("LANDNEXUS_BHUVAN_BASE_URL is not a valid URL");
        }
        if (uri.getHost() == null || !"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalStateException("LANDNEXUS_BHUVAN_BASE_URL must be an https URL");
        }
        if (timeoutSeconds < 1 || timeoutSeconds > 120) {
            throw new IllegalStateException("Bhuvan timeout must be between 1 and 120 seconds");
        }
        if (maxBytes < 1024 || maxBytes > 20 * 1024 * 1024) {
            throw new IllegalStateException("Bhuvan response size limit is out of range");
        }
    }

    @Override
    public String toString() {
        return "BhuvanConfig[enabled=" + enabled + ", tokenConfigured=" + tokenConfigured() + "]";
    }

    @Configuration
    static class BhuvanConfiguration {

        @Bean
        BhuvanConfig bhuvanConfig(
                @Value("${landnexus.bhuvan.enabled:false}") boolean enabled,
                @Value("${landnexus.bhuvan.base-url:https://bhuvan-app1.nrsc.gov.in/api}") String baseUrl,
                @Value("${landnexus.bhuvan.token:${BHUVAN_API_TOKEN:}}") String token,
                @Value("${landnexus.bhuvan.timeout-seconds:45}") int timeoutSeconds,
                @Value("${landnexus.bhuvan.max-bytes:2097152}") int maxBytes,
                @Value("${landnexus.bhuvan.village-states:AP,KA}") String villageStates,
                @Value("${landnexus.bhuvan.maharashtra-village-verified:false}") boolean maharashtraVerified) {
            Set<String> states = new LinkedHashSet<>();
            Arrays.stream(villageStates.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .map(value -> value.toUpperCase(Locale.ROOT))
                    .forEach(states::add);
            BhuvanConfig config = new BhuvanConfig(enabled, baseUrl.trim().replaceAll("/+$", ""), token == null ? "" : token.trim(),
                    timeoutSeconds, maxBytes, Set.copyOf(states), maharashtraVerified);
            config.validate();
            return config;
        }
    }
}
