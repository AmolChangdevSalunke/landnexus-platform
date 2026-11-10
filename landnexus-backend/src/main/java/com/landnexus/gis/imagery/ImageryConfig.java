package com.landnexus.gis.imagery;

import java.net.URI;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Where satellite imagery comes from (an OGC WMS). The secret is never printed, logged or sent to the browser. */
public record ImageryConfig(boolean enabled, String providerName, String baseUrl, String layers, String overlayBaseUrl,
                            String overlayLayers, String wmsVersion, String imageFormat, String authMode, String authName,
                            String authSecret, String attribution, int timeoutSeconds, int maxBytes, boolean allowInsecureHttp) {

    private static final Set<String> AUTH_MODES = Set.of("NONE", "QUERY_PARAM", "HEADER");
    private static final Set<String> VERSIONS = Set.of("1.1.1", "1.3.0");

    /** Fails fast, with a clear text, so a half-configured server never starts. Does nothing while imagery is disabled. */
    public void validate() {
        if (!enabled) {
            return;
        }
        requireUrl("LANDNEXUS_IMAGERY_URL", baseUrl);
        if (!overlayBaseUrl.isBlank()) {
            requireUrl("LANDNEXUS_IMAGERY_OVERLAY_URL", overlayBaseUrl);
        }
        if (layers.isBlank()) {
            throw new IllegalStateException("Imagery is enabled but LANDNEXUS_IMAGERY_LAYERS is empty");
        }
        if (!VERSIONS.contains(wmsVersion)) {
            throw new IllegalStateException("LANDNEXUS_IMAGERY_WMS_VERSION must be 1.1.1 or 1.3.0");
        }
        if (!AUTH_MODES.contains(authMode)) {
            throw new IllegalStateException("LANDNEXUS_IMAGERY_AUTH must be NONE, QUERY_PARAM or HEADER");
        }
        if (!"NONE".equals(authMode) && (authSecret.isBlank() || !authName.matches("^[A-Za-z0-9_-]{1,40}$"))) {
            throw new IllegalStateException("Imagery authentication needs LANDNEXUS_IMAGERY_SECRET and a simple LANDNEXUS_IMAGERY_AUTH_NAME");
        }
        if (timeoutSeconds < 1 || maxBytes < 1024) {
            throw new IllegalStateException("Imagery timeout or size limit is out of range");
        }
    }

    private void requireUrl(String variable, String value) {
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(variable + " is not a valid URL");
        }
        boolean https = "https".equalsIgnoreCase(uri.getScheme());
        boolean http = "http".equalsIgnoreCase(uri.getScheme());
        if (uri.getHost() == null || !(https || (http && allowInsecureHttp))) {
            throw new IllegalStateException(variable + " must be an https URL (http only with landnexus.imagery.allow-insecure-http=true)");
        }
    }

    @Override
    public String toString() {
        return "ImageryConfig[enabled=" + enabled + ", provider=" + providerName + "]";
    }

    @Configuration
    static class ImageryConfiguration {

        @Bean
        ImageryConfig imageryConfig(@Value("${landnexus.imagery.enabled:false}") boolean enabled,
                                    @Value("${landnexus.imagery.provider-name:ISRO Bhuvan}") String providerName,
                                    @Value("${landnexus.imagery.base-url:}") String baseUrl,
                                    @Value("${landnexus.imagery.layers:}") String layers,
                                    @Value("${landnexus.imagery.overlay-base-url:}") String overlayBaseUrl,
                                    @Value("${landnexus.imagery.overlay-layers:}") String overlayLayers,
                                    @Value("${landnexus.imagery.wms-version:1.1.1}") String version,
                                    @Value("${landnexus.imagery.image-format:image/png}") String format,
                                    @Value("${landnexus.imagery.auth-mode:NONE}") String authMode,
                                    @Value("${landnexus.imagery.auth-name:token}") String authName,
                                    @Value("${landnexus.imagery.auth-secret:}") String authSecret,
                                    @Value("${landnexus.imagery.attribution:}") String attribution,
                                    @Value("${landnexus.imagery.timeout-seconds:10}") int timeout,
                                    @Value("${landnexus.imagery.max-bytes:5242880}") int maxBytes,
                                    @Value("${landnexus.imagery.allow-insecure-http:false}") boolean insecure) {
            return new ImageryConfig(enabled, providerName, baseUrl.trim(), layers.trim(), overlayBaseUrl.trim(), overlayLayers.trim(),
                    version.trim(), format.trim(), authMode.trim().toUpperCase(java.util.Locale.ROOT), authName.trim(), authSecret,
                    attribution.trim(), timeout, maxBytes, insecure);
        }
    }
}