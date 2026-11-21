package com.landnexus.gis.bhuvan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.landnexus.gis.application.GisAccess;
import com.landnexus.gis.bhuvan.BhuvanClient.BhuvanException;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcAnalysis;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcClass;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcRecord;
import com.landnexus.gis.bhuvan.BhuvanDtos.VillageResult;
import com.landnexus.gis.bhuvan.BhuvanRepository.Aoi;
import com.landnexus.projects.application.ProjectLookupService;
import com.landnexus.reporting.application.CsvWriter;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class BhuvanServiceTest {

    private static final String WKT = "POLYGON((75.34 19.87,75.35 19.87,75.35 19.88,75.34 19.88,75.34 19.87))";
    private static final CurrentActor ACTOR = new CurrentActor(UUID.randomUUID(), "analyst",
            Set.of("GIS_USER"), Set.of(GisAccess.READ));

    private final ObjectMapper mapper = new ObjectMapper();
    private final BhuvanClient client = mock(BhuvanClient.class);
    private final BhuvanRepository repo = mock(BhuvanRepository.class);
    private final ProjectLookupService projects = mock(ProjectLookupService.class);
    private final GisAccess access = mock(GisAccess.class);
    private final AuditService audit = mock(AuditService.class);

    private BhuvanService service(BhuvanConfig config) {
        return new BhuvanService(config, client, repo, projects, access, audit, mapper);
    }

    private static BhuvanConfig config(boolean enabled, boolean withToken, boolean maharashtraVerified) {
        return new BhuvanConfig(enabled, "https://bhuvan.example/api", withToken ? "secret-token" : "", 30, 1024 * 1024,
                Set.of("AP", "KA"), maharashtraVerified);
    }

    private BhuvanService enabledService(boolean maharashtraVerified) {
        return service(config(true, true, maharashtraVerified));
    }

    // ------------------------------------------------------------------ parsing

    @Test
    void parseRecords_normalisesTheCommonProviderKeySpellings() {
        JsonNode root = mapper.readTree("""
                [{"Year":"2021-22","LULC Description":"Cropland","Area in sq km":"1,234.5"},
                 {"Year":"2020-21","land_use":"Forest","Area_sq_km":"12.25"},
                 {"Year":"2019-20","category":"Water","area":"3"}]
                """);

        List<LulcRecord> records = BhuvanService.parseRecords(root);

        assertThat(records).hasSize(3);
        assertThat(records.get(0).year()).isEqualTo("2021-22");
        assertThat(records.get(0).description()).isEqualTo("Cropland");
        assertThat(records.get(0).areaSqKm()).isEqualByComparingTo("1234.5000");
        assertThat(records.get(1).description()).isEqualTo("Forest");
        assertThat(records.get(2).description()).isEqualTo("Water");
    }

    @Test
    void parseRecords_readsADataWrapperASingleObject_andSkipsRowsItCannotDescribe() {
        assertThat(BhuvanService.parseRecords(mapper.readTree("{\"data\":[{\"year\":\"2020\",\"class\":\"Bare\"}]}")))
                .extracting(LulcRecord::description).containsExactly("Bare");
        assertThat(BhuvanService.parseRecords(mapper.readTree("{\"year\":\"2020\",\"description\":\"Grass\"}")))
                .extracting(LulcRecord::description).containsExactly("Grass");
        assertThat(BhuvanService.parseRecords(mapper.readTree("[{\"year\":\"2020\"},{\"foo\":1}]"))).isEmpty();
        assertThat(BhuvanService.parseRecords(mapper.readTree("null"))).isEmpty();
        assertThat(BhuvanService.parseRecords(mapper.readTree("false"))).isEmpty();
    }

    @Test
    void totals_aggregateByClass_sortLargestFirst_andCountRows() {
        List<LulcRecord> records = List.of(
                new LulcRecord("2020", "Forest", new BigDecimal("2.5"), Map.of()),
                new LulcRecord("2021", "Forest", new BigDecimal("1.5"), Map.of()),
                new LulcRecord("2020", "Water", new BigDecimal("0.25"), Map.of()),
                new LulcRecord("2020", "No area", null, Map.of()));

        List<LulcClass> totals = BhuvanService.totals(records);

        assertThat(totals).extracting(LulcClass::description).containsExactly("Forest", "Water", "No area");
        assertThat(totals.get(0).areaSqKm()).isEqualByComparingTo("4.0000");
        assertThat(totals.get(0).records()).isEqualTo(2);
        assertThat(totals.get(2).areaSqKm()).isEqualByComparingTo("0.0000");
    }

    @Test
    void years_areDistinctAndSorted_andBlankYearsAreDropped() {
        List<LulcRecord> records = List.of(
                new LulcRecord("2021", "a", BigDecimal.ONE, Map.of()),
                new LulcRecord("2019", "b", BigDecimal.ONE, Map.of()),
                new LulcRecord("2021", "c", BigDecimal.ONE, Map.of()),
                new LulcRecord(" ", "d", BigDecimal.ONE, Map.of()),
                new LulcRecord(null, "e", BigDecimal.ONE, Map.of()));

        assertThat(BhuvanService.years(records)).containsExactly("2019", "2021");
    }

    // ------------------------------------------------------------------ LULC analysis

    @Test
    void analyse_withAWktAoi_callsBhuvanOnce_andReturnsTotalsWithoutLeakingTheToken() {
        UUID runId = UUID.randomUUID();
        when(repo.normaliseWkt(WKT)).thenReturn(new Aoi(WKT, new BigDecimal("123.4567"), "USER_WKT", "POLYGON"));
        when(client.lulcAoi(WKT)).thenReturn(mapper.readTree("""
                [{"year":"2021-22","description":"Cropland","area_sq_km":"10.5"},
                 {"year":"2021-22","description":"Forest","area_sq_km":"2.5"}]
                """));
        when(repo.insertRun(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyInt(), any(),
                any(), any(), any())).thenReturn(runId);

        LulcAnalysis analysis = enabledService(false).analyse(null, WKT, ACTOR);

        assertThat(analysis.runId()).isEqualTo(runId);
        assertThat(analysis.status()).isEqualTo("SUCCESS");
        assertThat(analysis.aoiSource()).isEqualTo("USER_WKT");
        assertThat(analysis.aoiAreaHa()).isEqualByComparingTo("123.4567");
        assertThat(analysis.records()).hasSize(2);
        assertThat(analysis.totals()).extracting(LulcClass::description).containsExactly("Cropland", "Forest");
        assertThat(analysis.years()).containsExactly("2021-22");
        assertThat(analysis.toString()).doesNotContain("secret-token");
        verify(repo).insertRun(isNull(), isNull(), isNull(), isNull(), isNull(), any(), any(), any(), any(), any(),
                anyInt(), any(), any(), any(), any());
        verify(audit).record(any(), any(), any(), any());
    }

    @Test
    void analyse_whenProviderReturnsNoData_isStoredAsNoData() {
        UUID runId = UUID.randomUUID();
        when(repo.normaliseWkt(WKT)).thenReturn(new Aoi(WKT, new BigDecimal("1.0"), "USER_WKT", "POLYGON"));
        when(client.lulcAoi(WKT)).thenReturn(mapper.readTree("null"));
        when(repo.insertRun(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyInt(), any(),
                any(), any(), any())).thenReturn(runId);

        LulcAnalysis analysis = enabledService(false).analyse(null, WKT, ACTOR);

        assertThat(analysis.status()).isEqualTo("NO_DATA");
        assertThat(analysis.records()).isEmpty();
        assertThat(analysis.totals()).isEmpty();
        assertThat(analysis.years()).isEmpty();
    }

    @Test
    void analyse_whenBhuvanFails_keepsAFailedHistoryRow_andRethrowsTheSafeError() {
        when(repo.normaliseWkt(WKT)).thenReturn(new Aoi(WKT, new BigDecimal("1.0"), "USER_WKT", "POLYGON"));
        when(client.lulcAoi(WKT)).thenThrow(new BhuvanException(BhuvanException.Kind.AUTHENTICATION_FAILED,
                "Bhuvan rejected the configured access token"));

        assertThatThrownBy(() -> enabledService(false).analyse(null, WKT, ACTOR))
                .isInstanceOf(BhuvanException.class)
                .hasMessageContaining("rejected")
                .hasMessageNotContaining("secret-token");
        verify(repo).insertRun(isNull(), isNull(), isNull(), isNull(), isNull(), any(), any(), any(), eq("FAILED"),
                any(), anyInt(), any(), any(), any(), any());
        verify(audit, never()).record(any(), any(), any(), any());
    }

    @Test
    void analyse_refusesAnEmptyRequest_andAnOversizedWkt() {
        assertThatThrownBy(() -> enabledService(false).analyse(null, "  ", ACTOR))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Choose a project");
        assertThatThrownBy(() -> enabledService(false).analyse(null, "P".repeat(BhuvanService.MAX_WKT_CHARS + 1), ACTOR))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("too large");
        verifyNoInteractions(client);
    }

    // ------------------------------------------------------------------ village coverage

    @Test
    void villageGeocode_refusesMaharashtra_untilAVerifiedCheckIsRecorded() {
        assertThatThrownBy(() -> enabledService(false).villageGeocode("Pune", "MH", ACTOR))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Maharashtra support has not been verified")
                .hasMessageContaining("LANDNEXUS_BHUVAN_MAHARASHTRA_VILLAGE_VERIFIED");
        verifyNoInteractions(client);
    }

    @Test
    void villageGeocode_allowsMaharashtra_whenTheOperatorHasVerifiedIt() {
        when(client.villageGeocode("Pune")).thenReturn(mapper.readTree("[{\"village_name\":\"Pune\"}]"));

        VillageResult result = enabledService(true).villageGeocode("Pune", "MH", ACTOR);

        assertThat(result.stateCode()).isEqualTo("MH");
        assertThat(result.maharashtraVerified()).isTrue();
        assertThat(result.recordCount()).isEqualTo(1);
        assertThat(result.records()).containsExactly(Map.of("village_name", "Pune"));
        verify(client).villageGeocode("Pune");
    }

    @Test
    void villageGeocode_allowsTheDocumentedStates_andRefusesOthers() {
        when(client.villageGeocode("Vijayawada")).thenReturn(mapper.readTree("[]"));

        VillageResult result = enabledService(false).villageGeocode("Vijayawada", "AP", ACTOR);

        assertThat(result.recordCount()).isZero();
        assertThat(result.endpoint()).isEqualTo(BhuvanClient.VILLAGE_GEOCODE_PATH);
        assertThatThrownBy(() -> enabledService(false).villageGeocode("Pune", "MH", ACTOR))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> enabledService(false).villageGeocode("Kolkata", "WB", ACTOR))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("not WB");
    }

    @Test
    void villageGeocode_validatesTheVillageName_andNeverCallsOutForABadOne() {
        assertThatThrownBy(() -> enabledService(false).villageGeocode("x", "AP", ACTOR))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("2 and 120");
        assertThatThrownBy(() -> enabledService(false).villageGeocode(null, "AP", ACTOR))
                .isInstanceOf(InvalidRequestException.class);
        verifyNoInteractions(client);
    }

    @Test
    void villageReverse_validatesCoordinates_andRefusesWhenNotConfigured() {
        assertThatThrownBy(() -> enabledService(false).villageReverse(91, 75, "AP", ACTOR))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("-90..90");
        assertThatThrownBy(() -> enabledService(false).villageReverse(Double.NaN, 75, "AP", ACTOR))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> service(config(false, false, false)).villageReverse(19.87, 75.34, "AP", ACTOR))
                .isInstanceOf(BhuvanException.class)
                .hasMessageContaining("not enabled");
        verifyNoInteractions(client);
    }

    @Test
    void villageReverse_returnsTheRecordsForADocumentedState() {
        when(client.villageReverse(19.87, 75.34)).thenReturn(mapper.readTree("{\"village\":\"Somewhere\"}"));

        VillageResult result = enabledService(false).villageReverse(19.87, 75.34, "ka", ACTOR);

        assertThat(result.stateCode()).isEqualTo("KA");
        assertThat(result.query()).isEqualTo("19.87,75.34");
        assertThat(result.records()).containsExactly(Map.of("village", "Somewhere"));
    }

    // ------------------------------------------------------------------ status and PDF

    @Test
    void status_reportsTheConfiguredCapabilities_withoutTheToken() {
        var disabled = service(config(false, false, false)).status();
        assertThat(disabled.enabled()).isFalse();
        assertThat(disabled.lulcAvailable()).isFalse();
        assertThat(disabled.message()).contains("disabled");

        var enabled = enabledService(false).status();
        assertThat(enabled.enabled()).isTrue();
        assertThat(enabled.tokenConfigured()).isTrue();
        assertThat(enabled.lulcAvailable()).isTrue();
        assertThat(enabled.documentedVillageStates()).containsExactlyInAnyOrder("AP", "KA");
        assertThat(enabled.maharashtraVillageVerified()).isFalse();
        assertThat(enabled.toString()).doesNotContain("secret-token");
    }

    @Test
    void pdfExport_hasAValidHeaderTrailer_andEscapesText() {
        byte[] pdf = SimplePdfWriter.write("Title", List.of("Area (ha) \\ test", "Unicode: \u20B9 100"));

        String text = new String(pdf, StandardCharsets.ISO_8859_1);
        assertThat(text).startsWith("%PDF-1.4");
        assertThat(text).contains("/Count 1", "startxref", "%%EOF", "/BaseFont /Helvetica");
        assertThat(text).contains("Area \\(ha\\) \\\\ test");
        assertThat(text).contains("Unicode: ? 100");
    }

    @Test
    void pdfExport_spillsOntoMorePagesForLongReports() {
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < 120; i++) {
            lines.add("line " + i);
        }

        String text = new String(SimplePdfWriter.write("Long report", lines), StandardCharsets.ISO_8859_1);

        assertThat(text).contains("/Count 3");
    }

    @Test
    void csvExport_usesTheExistingWriter_andTheStoredRun() {
        UUID runId = UUID.randomUUID();
        when(repo.findRun(runId)).thenReturn(java.util.Optional.of(new BhuvanRepository.StoredRun(runId, null, null,
                "MH", "Maharashtra", "Pune", "USER_WKT", new BigDecimal("12.5"), "SUCCESS", "ok", 1,
                new BigDecimal("10.5"), "analyst", java.time.Instant.parse("2026-01-01T00:00:00Z"),
                "[{\"year\":\"2021\",\"description\":\"Cropland\",\"area_sq_km\":\"10.5\"}]")));

        var file = enabledService(false).exportCsv(runId, ACTOR);

        String csv = new String(file.content(), StandardCharsets.UTF_8);
        assertThat(csv).startsWith(CsvWriter.BOM
                        + "Analysis ID,Project,State,District,AOI source,AOI area (ha),Year,LULC description,Area (sq km)")
                .contains("Cropland", "10.5000", "Maharashtra");
        assertThat(file.contentType()).startsWith("text/csv");
        assertThat(file.filename()).endsWith(".csv");
    }
}
