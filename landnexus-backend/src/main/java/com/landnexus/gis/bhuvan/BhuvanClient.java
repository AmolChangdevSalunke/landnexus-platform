package com.landnexus.gis.bhuvan;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import com.landnexus.shared.logging.LogSanitizer;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * One small GET client for the Bhuvan API. The token is added only here, in the request query, and is never included
 * in an exception message or a log line. Redirects are not followed and the answer is bounded.
 */
@Component
public class BhuvanClient {

    private static final Logger log = LoggerFactory.getLogger(BhuvanClient.class);

    static final String VILLAGE_GEOCODE_PATH = "/api_proximity/curl_village_geocode.php";
    static final String VILLAGE_REVERSE_PATH = "/api_proximity/curl_reverse_village.php";
    static final String LULC_AOI_PATH = "/lulc/curl_aoi.php";

    /** A provider problem in terms the API can report without leaking the URL or the token. */
    public static final class BhuvanException extends RuntimeException {
        public enum Kind { NOT_CONFIGURED, AUTHENTICATION_FAILED, RATE_LIMITED, INVALID_REQUEST, UNAVAILABLE, BAD_RESPONSE }

        private final Kind kind;
        private final Integer providerStatus;

        public BhuvanException(Kind kind, String message) {
            this(kind, message, null);
        }

        public BhuvanException(Kind kind, String message, Integer providerStatus) {
            super(message);
            this.kind = kind;
            this.providerStatus = providerStatus;
        }

        public Kind kind() {
            return kind;
        }

        public Integer providerStatus() {
            return providerStatus;
        }

        public int httpStatus() {
            return switch (kind) {
                case NOT_CONFIGURED -> 503;
                case AUTHENTICATION_FAILED -> 502;
                case RATE_LIMITED -> 429;
                case INVALID_REQUEST -> 400;
                case UNAVAILABLE, BAD_RESPONSE -> 502;
            };
        }
    }

    private final BhuvanConfig config;
    private final ObjectMapper objectMapper;
    private final HttpClient client;

    @Autowired
    public BhuvanClient(BhuvanConfig config, ObjectMapper objectMapper) {
        this(config, objectMapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(config.timeoutSeconds()))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    BhuvanClient(BhuvanConfig config, ObjectMapper objectMapper, HttpClient client) {
        this.config = config;
        this.objectMapper = objectMapper;
        this.client = client;
    }

    public JsonNode villageGeocode(String village) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("village", village);
        return get(VILLAGE_GEOCODE_PATH, params);
    }

    public JsonNode villageReverse(double lat, double lon) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("lat", Double.toString(lat));
        params.put("lon", Double.toString(lon));
        return get(VILLAGE_REVERSE_PATH, params);
    }

    public JsonNode lulcAoi(String wktPolygon) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("geom", wktPolygon);
        return get(LULC_AOI_PATH, params);
    }

    /** Reads the provider answer as JSON. False/null means "no data in the database" according to the Bhuvan docs. */
    public JsonNode get(String path, Map<String, String> parameters) {
        if (!config.enabled()) {
            throw new BhuvanException(BhuvanException.Kind.NOT_CONFIGURED, "Bhuvan integration is not enabled on this server");
        }
        if (!config.tokenConfigured()) {
            throw new BhuvanException(BhuvanException.Kind.NOT_CONFIGURED, "Bhuvan access token is not configured on this server");
        }
        long started = System.nanoTime();
        try {
            JsonNode body = execute(path, parameters, started);
            return body;
        } catch (BhuvanException ex) {
            // path and kind only: the request URL contains the token and must never be logged.
            log.warn("Bhuvan call {} failed: {} ({})", path, ex.kind(), LogSanitizer.safe(ex.getMessage()));
            throw ex;
        }
    }

    private JsonNode execute(String path, Map<String, String> parameters, long started) {
        StringBuilder url = new StringBuilder(config.baseUrl()).append(path).append('?');
        url.append(parameters.entrySet().stream()
                .map(entry -> enc(entry.getKey()) + "=" + enc(entry.getValue()))
                .collect(Collectors.joining("&")));
        url.append("&token=").append(enc(config.token()));

        HttpRequest request = HttpRequest.newBuilder(URI.create(url.toString()))
                .timeout(Duration.ofSeconds(config.timeoutSeconds()))
                .header("Accept", "application/json")
                // The Bhuvan documentation asks for this content type on its GET endpoints.
                .header("Content-Type", "application/x-www-form-urlencoded")
                .GET()
                .build();
        try {
            HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream in = response.body()) {
                byte[] bytes = in.readNBytes(config.maxBytes() + 1);
                if (bytes.length > config.maxBytes()) {
                    throw new BhuvanException(BhuvanException.Kind.BAD_RESPONSE, "The Bhuvan response is too large");
                }
                int status = response.statusCode();
                if (status == 401 || status == 403) {
                    throw new BhuvanException(BhuvanException.Kind.AUTHENTICATION_FAILED,
                            "Bhuvan rejected the configured access token", status);
                }
                if (status == 429) {
                    throw new BhuvanException(BhuvanException.Kind.RATE_LIMITED,
                            "Bhuvan is rate limiting this server; try again later", status);
                }
                if (status >= 400) {
                    if (status == 400) {
                        throw new BhuvanException(BhuvanException.Kind.INVALID_REQUEST,
                                "Bhuvan rejected the request parameters", status);
                    }
                    throw new BhuvanException(BhuvanException.Kind.UNAVAILABLE,
                            "Bhuvan answered with HTTP " + status, status);
                }
                String text = new String(bytes, StandardCharsets.UTF_8).trim();
                if (text.isEmpty()) {
                    throw new BhuvanException(BhuvanException.Kind.BAD_RESPONSE, "Bhuvan returned an empty response", status);
                }
                try {
                    JsonNode body = objectMapper.readTree(text);
                    checkProviderError(body, status);
                    log.debug("Bhuvan call {} answered HTTP {} in {} ms", path, status,
                            (System.nanoTime() - started) / 1_000_000L);
                    return body;
                } catch (tools.jackson.core.JacksonException e) {
                    throw new BhuvanException(BhuvanException.Kind.BAD_RESPONSE,
                            "Bhuvan did not return JSON (check the configured endpoint)", status);
                }
            }
        } catch (HttpTimeoutException e) {
            throw new BhuvanException(BhuvanException.Kind.UNAVAILABLE, "Bhuvan did not answer in time");
        } catch (IOException e) {
            throw new BhuvanException(BhuvanException.Kind.UNAVAILABLE, "Bhuvan could not be reached");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BhuvanException(BhuvanException.Kind.UNAVAILABLE, "The Bhuvan request was interrupted");
        }
    }

    /** Bhuvan reports an invalid token as HTTP 200 with a JSON error object, so the body has to be checked too. */
    static void checkProviderError(JsonNode body, int status) {
        if (body == null) {
            return;
        }
        String error = body.path("error").asText("");
        if (!error.isEmpty()) {
            if ("invalid_token".equalsIgnoreCase(error)) {
                throw new BhuvanException(BhuvanException.Kind.AUTHENTICATION_FAILED,
                        "Bhuvan rejected the configured access token", status);
            }
            throw new BhuvanException(BhuvanException.Kind.BAD_RESPONSE,
                    "Bhuvan reported an error: " + safeErrorText(body), status);
        }
        if (body.isBoolean() && !body.booleanValue()) {
            return;
        }
        if (!body.isArray() && !body.isObject() && !body.isNull()) {
            throw new BhuvanException(BhuvanException.Kind.BAD_RESPONSE, "Bhuvan returned an unexpected JSON value", status);
        }
    }

    private static String safeErrorText(JsonNode body) {
        String description = body.path("error_description").asText("");
        String chosen = description.isEmpty() ? body.path("error").asText("unknown") : description;
        String cleaned = chosen.replaceAll("[\\r\\n\\t]", " ").trim();
        return cleaned.length() > 160 ? cleaned.substring(0, 160) : cleaned;
    }

    public static boolean noData(JsonNode body) {
        return body == null || body.isNull() || (body.isBoolean() && !body.booleanValue())
                || (body.isArray() && body.isEmpty());
    }

    public static Optional<String> firstText(JsonNode body) {
        if (body == null || !body.isArray() || body.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(body.get(0).toString());
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}

