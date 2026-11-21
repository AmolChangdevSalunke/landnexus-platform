package com.landnexus.gis.bhuvan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.gis.bhuvan.BhuvanClient.BhuvanException;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** A local server plays the Bhuvan host, so the adapter can be tested without the real token or network. */
class BhuvanClientTest {

    private static final String SECRET = "test-token-value";
    private static final String POLYGON = "POLYGON((75.34 19.87,75.35 19.87,75.35 19.88,75.34 19.88,75.34 19.87))";

    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<String> path = new AtomicReference<>();
    private final AtomicReference<String> query = new AtomicReference<>();
    private final AtomicReference<String> accept = new AtomicReference<>();
    private final AtomicReference<byte[]> body = new AtomicReference<>("[]".getBytes(StandardCharsets.UTF_8));
    private final AtomicReference<Integer> status = new AtomicReference<>(200);
    private final AtomicInteger calls = new AtomicInteger();

    private HttpServer server;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api", exchange -> {
            calls.incrementAndGet();
            path.set(exchange.getRequestURI().getPath());
            query.set(exchange.getRequestURI().getRawQuery());
            accept.set(exchange.getRequestHeaders().getFirst("Accept"));
            byte[] bytes = body.get();
            exchange.sendResponseHeaders(status.get(), bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private BhuvanConfig config(boolean enabled, boolean withToken, int maxBytes) {
        return new BhuvanConfig(enabled, "http://127.0.0.1:" + server.getAddress().getPort() + "/api",
                withToken ? SECRET : "", 5, maxBytes, Set.of("AP", "KA"), false);
    }

    private BhuvanClient client() {
        return new BhuvanClient(config(true, true, 4096), mapper);
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    @Test
    void villageGeocode_sendsTheDocumentedPathAndTheTokenInTheQuery() {
        body.set("[\"Maharashtra village\"]".getBytes(StandardCharsets.UTF_8));

        JsonNode result = client().villageGeocode("Pune Camp");

        assertThat(result.get(0).asText()).isEqualTo("Maharashtra village");
        assertThat(path.get()).isEqualTo("/api/api_proximity/curl_village_geocode.php");
        assertThat(decode(query.get())).contains("village=Pune Camp", "token=" + SECRET);
        assertThat(accept.get()).isEqualTo("application/json");
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void reverseVillage_sendsLatitudeAndLongitude() {
        client().villageReverse(19.8701, 75.3402);

        assertThat(path.get()).isEqualTo("/api/api_proximity/curl_reverse_village.php");
        assertThat(decode(query.get())).contains("lat=19.8701", "lon=75.3402", "token=" + SECRET);
    }

    @Test
    void lulcAoi_sendsTheWktAsTheGeomParameter() {
        body.set("{\"data\":[]}".getBytes(StandardCharsets.UTF_8));

        client().lulcAoi(POLYGON);

        assertThat(path.get()).isEqualTo("/api/lulc/curl_aoi.php");
        assertThat(decode(query.get())).contains("geom=" + POLYGON, "token=" + SECRET);
    }

    @Test
    void anInvalidTokenReportedAsHttp200_isAnAuthenticationFailure_andTheTokenIsNeverShown() {
        body.set(("{\"error\":\"invalid_token\",\"error_description\":\"The access token provided is invalid\"}")
                .getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> client().lulcAoi(POLYGON))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.AUTHENTICATION_FAILED);
                    assertThat(error.httpStatus()).isEqualTo(502);
                    assertThat(error.providerStatus()).isEqualTo(200);
                    assertThat(error.getMessage()).doesNotContain(SECRET).doesNotContain("127.0.0.1");
                });
    }

    @Test
    void anotherProviderError_isABadResponseWithACleanedMessage() {
        body.set("{\"error\":\"invalid_request\",\"error_description\":\"Missing\\ngeom\\tvalue\"}"
                .getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> client().lulcAoi(POLYGON))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.BAD_RESPONSE);
                    assertThat(error.getMessage()).contains("Missing geom value").doesNotContain("\n").doesNotContain("\t");
                });
    }

    @Test
    void noData_isRecognisedForFalseNullAndAnEmptyArray() {
        assertThat(BhuvanClient.noData(null)).isTrue();
        assertThat(BhuvanClient.noData(mapper.readTree("false"))).isTrue();
        assertThat(BhuvanClient.noData(mapper.readTree("null"))).isTrue();
        assertThat(BhuvanClient.noData(mapper.readTree("[]"))).isTrue();
        assertThat(BhuvanClient.noData(mapper.readTree("[{\"year\":\"2020\"}]"))).isFalse();
        assertThat(BhuvanClient.noData(mapper.readTree("\"text\""))).isFalse();
    }

    @Test
    void aResponseOverTheConfiguredLimit_isRefused() {
        body.set("0123456789abcdefghijklmnop".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> new BhuvanClient(config(true, true, 16), mapper).villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.BAD_RESPONSE);
                    assertThat(error.getMessage()).contains("too large");
                });
    }

    @Test
    void providerHttpStatuses_mapToSafeErrors() {
        status.set(401);
        assertThatThrownBy(() -> client().villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error ->
                        assertThat(error.kind()).isEqualTo(BhuvanException.Kind.AUTHENTICATION_FAILED));

        status.set(429);
        assertThatThrownBy(() -> client().villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error ->
                        assertThat(error.kind()).isEqualTo(BhuvanException.Kind.RATE_LIMITED));

        status.set(400);
        assertThatThrownBy(() -> client().villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error ->
                        assertThat(error.kind()).isEqualTo(BhuvanException.Kind.INVALID_REQUEST));

        status.set(503);
        assertThatThrownBy(() -> client().villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.UNAVAILABLE);
                    assertThat(error.getMessage()).contains("HTTP 503");
                });
    }

    @Test
    void anEmptyOrNonJsonAnswer_isABadResponse() {
        body.set(new byte[0]);
        assertThatThrownBy(() -> client().villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.BAD_RESPONSE);
                    assertThat(error.getMessage()).contains("empty");
                });

        body.set("<html>maintenance</html>".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> client().villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.BAD_RESPONSE);
                    assertThat(error.getMessage()).contains("did not return JSON");
                });
    }

    @Test
    void disabledOrTokenlessServer_neverCallsTheProvider() {
        assertThatThrownBy(() -> new BhuvanClient(config(false, true, 4096), mapper).villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.NOT_CONFIGURED);
                    assertThat(error.httpStatus()).isEqualTo(503);
                    assertThat(error.getMessage()).contains("not enabled");
                });
        assertThatThrownBy(() -> new BhuvanClient(config(true, false, 4096), mapper).villageGeocode("Pune"))
                .isInstanceOfSatisfying(BhuvanException.class, error -> {
                    assertThat(error.kind()).isEqualTo(BhuvanException.Kind.NOT_CONFIGURED);
                    assertThat(error.getMessage()).contains("token");
                });
        assertThat(calls.get()).isZero();
    }

    @Test
    void firstText_returnsTheRawFirstRecordAndEmptyWhenThereIsNone() {
        assertThat(BhuvanClient.firstText(mapper.readTree("[{\"village\":\"Pune\"}]")))
                .hasValue("{\"village\":\"Pune\"}");
        assertThat(BhuvanClient.firstText(mapper.readTree("[]"))).isEmpty();
        assertThat(BhuvanClient.firstText(null)).isEmpty();
    }
}
