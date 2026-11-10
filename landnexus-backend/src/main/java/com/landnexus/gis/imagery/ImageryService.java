package com.landnexus.gis.imagery;

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
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Fetches ONE WMS GetMap picture for a bounding box on behalf of the browser. The browser never sees the provider URL or
 * the secret. The user can only choose numbers (box and size): the host, layers and credentials come from the
 * configuration, redirects are never followed, only PNG/JPEG/GIF/WebP answers within a size limit are passed on.
 */
@Service
public class ImageryService {

    public enum Layer { IMAGERY, OVERLAY }

    public record Status(boolean enabled, String provider, String kind, boolean overlayAvailable, String attribution, String message) {
    }

    public record Image(byte[] bytes, String contentType) {
    }

    public record TestResult(boolean ok, Integer httpStatus, String contentType, int bytes, long elapsedMs, String message) {
    }

    /** status is the HTTP status the API should answer with. The message never contains the URL or the secret. */
    public static final class ImageryException extends RuntimeException {
        private final int status;

        public ImageryException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }
    }

    private static final Set<String> IMAGE_TYPES = Set.of("image/png", "image/jpeg", "image/gif", "image/webp");
    static final double MIN_LON = 68.0;
    static final double MAX_LON = 97.5;
    static final double MIN_LAT = 6.0;
    static final double MAX_LAT = 37.6;
    static final double MAX_SPAN_DEGREES = 5.0;

    private final ImageryConfig config;
    private final HttpClient client;

    @Autowired
    public ImageryService(ImageryConfig config) {
        this(config, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(Math.max(1, config.timeoutSeconds())))
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    ImageryService(ImageryConfig config, HttpClient client) {
        config.validate();
        this.config = config;
        this.client = client;
    }

    public Status status() {
        boolean overlay = config.enabled() && !config.overlayLayers().isBlank();
        String message = config.enabled()
                ? "Satellite imagery is enabled (" + config.providerName() + ")."
                : "Satellite imagery is not enabled. Get access from the provider (for example ISRO Bhuvan), then follow docs/IMAGERY_SETUP.md.";
        return new Status(config.enabled(), config.providerName(), "WMS", overlay, config.enabled() ? config.attribution() : "", message);
    }

    public TestResult test() {
        long started = System.nanoTime();
        try {
            Image image = fetch(Layer.IMAGERY, 73.80, 18.45, 73.90, 18.55, 64, 64);
            return new TestResult(true, 200, image.contentType(), image.bytes().length, elapsed(started), "The provider answered with a picture.");
        } catch (ImageryException e) {
            return new TestResult(false, null, null, 0, elapsed(started), e.getMessage());
        }
    }

    public Image fetch(Layer layer, double minLon, double minLat, double maxLon, double maxLat, int width, int height) {
        if (!config.enabled()) {
            throw new ImageryException(503, "Satellite imagery is not enabled on this server");
        }
        checkBox(minLon, minLat, maxLon, maxLat, width, height);
        boolean overlay = layer == Layer.OVERLAY;
        String layers = overlay ? config.overlayLayers() : config.layers();
        if (layers.isBlank()) {
            throw new ImageryException(404, "No overlay layer is configured");
        }
        String base = overlay && !config.overlayBaseUrl().isBlank() ? config.overlayBaseUrl() : config.baseUrl();
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url(base, layers, overlay, minLon, minLat, maxLon, maxLat, width, height)))
                .timeout(Duration.ofSeconds(config.timeoutSeconds())).header("Accept", "image/png,image/jpeg,image/*").GET();
        if ("HEADER".equals(config.authMode())) {
            request.header(config.authName(), config.authSecret());
        }
        try {
            HttpResponse<InputStream> response = client.send(request.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream in = response.body()) {
                if (response.statusCode() != 200) {
                    throw new ImageryException(502, "The imagery service answered with HTTP " + response.statusCode());
                }
                String type = response.headers().firstValue("Content-Type").orElse("").split(";")[0].trim().toLowerCase(Locale.ROOT);
                if (!IMAGE_TYPES.contains(type)) {
                    throw new ImageryException(502, "The imagery service did not return a picture (check the layer names and the credentials)");
                }
                byte[] bytes = in.readNBytes(config.maxBytes() + 1);
                if (bytes.length > config.maxBytes()) {
                    throw new ImageryException(502, "The imagery service returned a picture that is too large");
                }
                return new Image(bytes, type);
            }
        } catch (HttpTimeoutException e) {
            throw new ImageryException(504, "The imagery service did not answer in time");
        } catch (IOException e) {
            throw new ImageryException(502, "The imagery service could not be reached");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ImageryException(502, "The request to the imagery service was interrupted");
        }
    }

    private String url(String base, String layers, boolean overlay, double minLon, double minLat, double maxLon, double maxLat, int w, int h) {
        boolean v130 = "1.3.0".equals(config.wmsVersion());
        // WMS 1.3.0 uses the axis order of the CRS: for EPSG:4326 that is latitude first
        String box = v130 ? coords(minLat, minLon, maxLat, maxLon) : coords(minLon, minLat, maxLon, maxLat);
        String joinedLayers = Arrays.stream(layers.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(ImageryService::enc)
                .collect(Collectors.joining(","));
        StringBuilder q = new StringBuilder(base.contains("?") ? (base.endsWith("?") || base.endsWith("&") ? "" : "&") : "?");
        q.append("service=WMS&request=GetMap&version=").append(enc(config.wmsVersion()))
                .append("&layers=").append(joinedLayers).append("&styles=")
                .append("&").append(v130 ? "crs" : "srs").append("=EPSG%3A4326")
                .append("&bbox=").append(box).append("&width=").append(w).append("&height=").append(h)
                .append("&format=").append(enc(overlay ? "image/png" : config.imageFormat()))
                .append("&transparent=").append(overlay);
        if ("QUERY_PARAM".equals(config.authMode())) {
            q.append("&").append(enc(config.authName())).append("=").append(enc(config.authSecret()));
        }
        return base + q;
    }

    private static void checkBox(double minLon, double minLat, double maxLon, double maxLat, int width, int height) {
        for (double v : new double[] {minLon, minLat, maxLon, maxLat}) {
            if (Double.isNaN(v) || Double.isInfinite(v)) {
                throw new ImageryException(400, "The bounding box must be four numbers");
            }
        }
        if (minLon >= maxLon || minLat >= maxLat) {
            throw new ImageryException(400, "The bounding box must be minLon,minLat,maxLon,maxLat with min below max");
        }
        if (minLon < MIN_LON || maxLon > MAX_LON || minLat < MIN_LAT || maxLat > MAX_LAT) {
            throw new ImageryException(400, "The bounding box must lie inside India: check that longitude and latitude are not swapped");
        }
        if (maxLon - minLon > MAX_SPAN_DEGREES || maxLat - minLat > MAX_SPAN_DEGREES) {
            throw new ImageryException(400, "The bounding box is too large (at most " + MAX_SPAN_DEGREES + " degrees on each side)");
        }
        if (width < 64 || width > 1024 || height < 64 || height > 1024) {
            throw new ImageryException(400, "Width and height must be between 64 and 1024 pixels");
        }
    }

    private static String coords(double a, double b, double c, double d) {
        return String.format(Locale.ROOT, "%.6f,%.6f,%.6f,%.6f", a, b, c, d);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static long elapsed(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }
}