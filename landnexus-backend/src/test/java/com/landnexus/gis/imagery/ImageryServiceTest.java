package com.landnexus.gis.imagery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.gis.imagery.ImageryService.Image;
import com.landnexus.gis.imagery.ImageryService.ImageryException;
import com.landnexus.gis.imagery.ImageryService.Layer;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;

/** A tiny local server plays the provider, so the adapter is tested without any real satellite service. */
class ImageryServiceTest {

    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
    private static final String SECRET = "S3CR3T-VALUE";

    private HttpServer server;
    private final AtomicReference<String> query = new AtomicReference<>();
    private final AtomicReference<String> keyHeader = new AtomicReference<>();
    private final AtomicReference<String> contentType = new AtomicReference<>("image/png");
    private final AtomicReference<byte[]> body = new AtomicReference<>(PNG);
    private final AtomicReference<Integer> status = new AtomicReference<>(200);

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/wms", exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            keyHeader.set(exchange.getRequestHeaders().getFirst("X-Api-Key"));
            byte[] bytes = body.get();
            exchange.getResponseHeaders().add("Content-Type", contentType.get());
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
//
//    private ImageryConfig config(boolean enabled, String authMode, String version, int maxBytes) {
//        return new ImageryConfig(enabled, "Test provider", "http://127.0.0.1:" + server.getAddress().getPort() + "/wms", "base:sat,base:roads",
//                "", "base:cadastre", version, "image/png", authMode, "X-Api-Key".equals(authMode) ? "X-Api-Key" : "token", SECRET, "attribution",
//                5, maxBytes, true);
//    }

    private ImageryConfig config(boolean enabled, String authMode, String version, int maxBytes) {
        String authName = "HEADER".equals(authMode) ? "X-Api-Key" : "token";

        return new ImageryConfig(
                enabled,
                "Test provider",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/wms",
                "base:sat,base:roads",
                "",
                "base:cadastre",
                version,
                "image/png",
                authMode,
                authName,
                SECRET,
                "attribution",
                5,
                maxBytes,
                true
        );
    }

    private ImageryService service(String authMode, String version) {
        return new ImageryService(config(true, authMode, version, 100_000));
    }

    private Image fetch(ImageryService s) {
        return s.fetch(Layer.IMAGERY, 75.34, 19.87, 75.35, 19.88, 256, 256);
    }

    @Test
    void sendsAWellFormedGetMap_withTheSecretInTheQuery_andPassesThePictureOn() {
        Image image = fetch(service("QUERY_PARAM", "1.1.1"));

        assertThat(image.bytes()).isEqualTo(PNG);
        assertThat(image.contentType()).isEqualTo("image/png");
        assertThat(query.get()).contains("service=WMS", "request=GetMap", "version=1.1.1", "layers=base%3Asat,base%3Aroads", "srs=EPSG%3A4326",
                "bbox=75.340000,19.870000,75.350000,19.880000", "width=256", "height=256", "format=image%2Fpng", "transparent=false", "token=" + SECRET);
    }

    @Test
    void headerAuthentication_putsTheSecretInAHeader_notInTheUrl() {
        fetch(service("HEADER", "1.1.1"));

        assertThat(keyHeader.get()).isEqualTo(SECRET);
        assertThat(query.get()).doesNotContain(SECRET);
    }

    @Test
    void wms130_usesCrsAndLatitudeFirstOrder() {
        fetch(service("NONE", "1.3.0"));

        assertThat(query.get()).contains("crs=EPSG%3A4326", "bbox=19.870000,75.340000,19.880000,75.350000").doesNotContain("srs=");
    }

    @Test
    void anOverlayIsATransparentPng_ofItsOwnLayer() {
        ImageryService s = service("NONE", "1.1.1");

        s.fetch(Layer.OVERLAY, 75.34, 19.87, 75.35, 19.88, 256, 256);

        assertThat(query.get()).contains("layers=base%3Acadastre", "transparent=true");
    }

    @Test
    void anAnswerThatIsNotAPicture_aFailure_orATooBigPicture_isRefused_withoutLeakingTheSecret() {
        contentType.set("text/xml");
        body.set("<ServiceException>no</ServiceException>".getBytes());
        assertThatThrownBy(() -> fetch(service("QUERY_PARAM", "1.1.1"))).isInstanceOfSatisfying(ImageryException.class,
                e -> assertThat(e.status()).isEqualTo(502)).hasMessageContaining("not return a picture").hasMessageNotContaining(SECRET);

        contentType.set("image/svg+xml");   // images that can carry script are not passed on
        assertThatThrownBy(() -> fetch(service("NONE", "1.1.1"))).isInstanceOf(ImageryException.class);

        contentType.set("image/png");
        status.set(500);
        assertThatThrownBy(() -> fetch(service("NONE", "1.1.1"))).hasMessageContaining("HTTP 500");

        status.set(200);
        body.set(new byte[5000]);
        assertThatThrownBy(() -> fetch(new ImageryService(config(true, "NONE", "1.1.1", 2048)))).hasMessageContaining("too large");
    }

    @Test
    void aBoxOutsideIndia_aSwappedBox_aHugeBox_orABadSize_neverReachTheProvider() {
        ImageryService s = service("NONE", "1.1.1");

        assertThatThrownBy(() -> s.fetch(Layer.IMAGERY, 19.87, 75.34, 19.88, 75.35, 256, 256)).hasMessageContaining("inside India");
        assertThatThrownBy(() -> s.fetch(Layer.IMAGERY, 70, 10, 80, 20, 256, 256)).hasMessageContaining("too large");
        assertThatThrownBy(() -> s.fetch(Layer.IMAGERY, 75.35, 19.87, 75.34, 19.88, 256, 256)).hasMessageContaining("min below max");
        assertThatThrownBy(() -> s.fetch(Layer.IMAGERY, 75.34, 19.87, 75.35, 19.88, 4000, 256)).hasMessageContaining("between 64 and 1024");
        assertThatThrownBy(() -> s.fetch(Layer.IMAGERY, Double.NaN, 19.87, 75.35, 19.88, 256, 256)).isInstanceOf(ImageryException.class);
        assertThat(query.get()).isNull();
    }

    @Test
    void whenDisabled_itSaysSo_andNeverCallsOut() {
        ImageryService s = new ImageryService(config(false, "NONE", "1.1.1", 100_000));

        assertThat(s.status().enabled()).isFalse();
        assertThat(s.status().message()).contains("not enabled");
        assertThatThrownBy(() -> fetch(s)).isInstanceOfSatisfying(ImageryException.class, e -> assertThat(e.status()).isEqualTo(503));
        assertThat(s.test().ok()).isFalse();
        assertThat(query.get()).isNull();
    }

    @Test
    void theConnectionTestReportsSuccess_andNeverTheUrlOrTheSecret() {
        ImageryService.TestResult ok = service("QUERY_PARAM", "1.1.1").test();

        assertThat(ok.ok()).isTrue();
        assertThat(ok.connectionState()).isEqualTo("CONNECTED");
        assertThat(ok.bytes()).isEqualTo(PNG.length);
        assertThat(ok.toString()).doesNotContain(SECRET).doesNotContain("127.0.0.1");
        status.set(403);
        ImageryService.TestResult rejected = service("QUERY_PARAM", "1.1.1").test();
        assertThat(rejected.ok()).isFalse();
        assertThat(rejected.connectionState()).isEqualTo("AUTHENTICATION_FAILED");
        assertThat(rejected.httpStatus()).isEqualTo(403);
        assertThat(rejected.toString()).doesNotContain(SECRET).doesNotContain("127.0.0.1");
    }

    @Test
    void aHalfConfiguredServer_failsAtStartup_withAClearMessage() {
        assertThatThrownBy(() -> new ImageryConfig(true, "x", "", "l", "", "", "1.1.1", "image/png", "NONE", "token", "", "", 5, 100_000, false).validate())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("LANDNEXUS_IMAGERY_URL");
        assertThatThrownBy(() -> new ImageryConfig(true, "x", "http://example.org/wms", "l", "", "", "1.1.1", "image/png", "NONE", "token", "", "", 5, 100_000, false).validate())
                .hasMessageContaining("https");
        assertThatThrownBy(() -> new ImageryConfig(true, "x", "https://example.org/wms", "", "", "", "1.1.1", "image/png", "NONE", "token", "", "", 5, 100_000, false).validate())
                .hasMessageContaining("LAYERS");
        assertThatThrownBy(() -> new ImageryConfig(true, "x", "https://example.org/wms", "l", "", "", "1.1.1", "image/png", "QUERY_PARAM", "token", "", "", 5, 100_000, false).validate())
                .hasMessageContaining("SECRET");
        new ImageryConfig(false, "x", "", "", "", "", "1.1.1", "image/png", "NONE", "token", "", "", 5, 100_000, false).validate();
    }

    private static final String CAPS = """
            <?xml version="1.0"?>
            <!DOCTYPE WMT_MS_Capabilities SYSTEM "http://schemas.opengis.net/wms/1.1.1/WMS_MS_Capabilities.dtd">
            <WMT_MS_Capabilities version="1.1.1"><Capability><Request><GetMap><Format>image/png</Format><Format>image/jpeg</Format></GetMap></Request>
            <Layer><Title>Root</Title><SRS>EPSG:4326 EPSG:900913</SRS>
              <Layer queryable="1"><Name>base:sat</Name><Title>Satellite</Title></Layer>
              <Layer><Name>base:cadastre</Name><Title>Cadastral lines</Title></Layer>
              <Layer><Title>Group without a name</Title></Layer>
            </Layer></Capability></WMT_MS_Capabilities>
            """;

    @Test
    void capabilities_listsLayersFormatsAndCrs_filtersThem_andSendsTheKeyButNeverReturnsIt() {
        contentType.set("text/xml");
        body.set(CAPS.strip().getBytes());

        ImageryService.Capabilities all = service("QUERY_PARAM", "1.1.1").capabilities(null);

        assertThat(all.layers()).extracting(ImageryService.LayerInfo::name).containsExactly("base:sat", "base:cadastre");
        assertThat(all.layers().get(0).queryable()).isTrue();
        assertThat(all.formats()).containsExactly("image/png", "image/jpeg");
        assertThat(all.crs()).contains("EPSG:4326", "EPSG:900913");
        assertThat(all.version()).isEqualTo("1.1.1");
        assertThat(query.get()).contains("request=GetCapabilities", "token=" + SECRET);
        assertThat(all.toString()).doesNotContain(SECRET).doesNotContain("127.0.0.1");
        assertThat(service("NONE", "1.1.1").capabilities("cadastr").layers()).extracting(ImageryService.LayerInfo::name).containsExactly("base:cadastre");
    }

    @Test
    void capabilities_neverReadsLocalFiles_fromAHostileDocument() throws Exception {
        Path secret = Files.createTempFile("xxe", ".txt");
        Files.writeString(secret, "XXE-SECRET");
        try {
            contentType.set("text/xml");
            body.set(("<?xml version=\"1.0\"?><!DOCTYPE x [<!ENTITY e SYSTEM \"" + secret.toUri() + "\">]>"
                    + "<WMS_Capabilities version=\"1.3.0\"><Layer><Name>l</Name><Title>&e;</Title></Layer></WMS_Capabilities>").getBytes());
            String shown;
            try {
                shown = service("NONE", "1.3.0").capabilities(null).toString();
            } catch (ImageryException e) {
                shown = e.getMessage();
            }
            assertThat(shown).doesNotContain("XXE-SECRET");
        } finally {
            Files.deleteIfExists(secret);
        }
    }

    @Test
    void capabilities_refusesAnAnswerThatIsNotXml_andANotEnabledServer() {
        contentType.set("image/png");
        body.set(PNG);
        assertThatThrownBy(() -> service("NONE", "1.1.1").capabilities(null)).hasMessageContaining("capabilities XML");

        assertThatThrownBy(() -> new ImageryService(config(false, "NONE", "1.1.1", 100_000)).capabilities(null))
                .isInstanceOfSatisfying(ImageryException.class, e -> assertThat(e.status()).isEqualTo(503));
    }
}