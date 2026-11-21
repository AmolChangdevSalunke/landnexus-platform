package com.landnexus.gis.bhuvan;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.landnexus.gis.bhuvan.BhuvanClient.BhuvanException;
import com.landnexus.gis.bhuvan.BhuvanDtos.HistoryPage;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcAnalysis;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcClass;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcRecord;
import com.landnexus.gis.bhuvan.BhuvanDtos.Status;
import com.landnexus.gis.bhuvan.BhuvanDtos.VillageResult;
import com.landnexus.gis.bhuvan.BhuvanRepository.Aoi;
import com.landnexus.gis.bhuvan.BhuvanRepository.ProjectGeography;
import com.landnexus.gis.bhuvan.BhuvanRepository.StoredRun;
import com.landnexus.projects.application.ProjectLookupService;
import com.landnexus.projects.application.ProjectLookupService.ProjectRef;
import com.landnexus.reporting.application.CsvWriter;
import com.landnexus.gis.application.GisAccess;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Bhuvan calls are made here, never in the browser. Only a project inside the caller's geographic scope can be used as
 * an AOI, and every result is stored so the analysis history and exports are reproducible.
 */
@Service
public class BhuvanService {

    private static final Logger log = LoggerFactory.getLogger(BhuvanService.class);

    static final String PROVIDER = "ISRO Bhuvan";
    static final int MAX_HISTORY_SIZE = 100;
    static final int MAX_WKT_CHARS = 200_000;
    static final String VILLAGE_COVERAGE_NOTE =
            "Bhuvan documents village geocoding and reverse geocoding for Andhra Pradesh and Karnataka only. "
                    + "Maharashtra is refused until a successful Maharashtra check is recorded.";

    private final BhuvanConfig config;
    private final BhuvanClient client;
    private final BhuvanRepository repo;
    private final ProjectLookupService projects;
    private final GisAccess access;
    private final AuditService audit;
    private final ObjectMapper objectMapper;

    public BhuvanService(BhuvanConfig config, BhuvanClient client, BhuvanRepository repo, ProjectLookupService projects,
                         GisAccess access, AuditService audit, ObjectMapper objectMapper) {
        this.config = config;
        this.client = client;
        this.repo = repo;
        this.projects = projects;
        this.access = access;
        this.audit = audit;
        this.objectMapper = objectMapper;
    }

    public Status status() {
        String message;
        if (!config.enabled()) {
            message = "Bhuvan integration is disabled. Set LANDNEXUS_BHUVAN_ENABLED=true and BHUVAN_API_TOKEN to use it.";
        } else if (!config.tokenConfigured()) {
            message = "Bhuvan is enabled but BHUVAN_API_TOKEN is empty.";
        } else {
            message = "Bhuvan is configured. LULC AOI analysis is available; village lookup is limited to the documented states.";
        }
        return new Status(config.enabled(), config.tokenConfigured(), config.enabled() && config.tokenConfigured(),
                config.enabled() && config.tokenConfigured(), config.maharashtraVillageVerified(),
                List.copyOf(config.villageDocumentedStates()), PROVIDER, message);
    }

    // ------------------------------------------------------------------ LULC AOI analysis

    public LulcAnalysis analyse(UUID projectId, String wkt, CurrentActor actor) {
        long started = System.nanoTime();
        ProjectRef project = projectId == null ? null : projects.findActiveProject(projectId)
                .filter(value -> access.canView(actor, value.districtId()))
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
        if (project == null && (wkt == null || wkt.isBlank())) {
            throw new InvalidRequestException("Choose a project with a corridor or supply a WKT Polygon as the AOI");
        }
        ProjectGeography geography = project == null ? null : repo.projectGeography(project.id()).orElse(null);
        Aoi aoi = wkt != null && !wkt.isBlank() ? userAoi(wkt) : repo.projectCorridorAoi(project.id())
                .orElseThrow(() -> new InvalidRequestException(
                        "This project has no corridor yet. Record an alignment first or supply a WKT Polygon as the AOI"));

        JsonNode body;
        try {
            body = client.lulcAoi(aoi.wkt());
        } catch (BhuvanException e) {
            // A failed attempt is kept in the history too; it is useful when diagnosing a token or coverage problem.
            repo.insertRun(project == null ? null : project.id(), project == null ? null : project.code(),
                    geography == null ? null : geography.stateCode(), geography == null ? null : geography.stateName(),
                    geography == null ? null : geography.districtName(), aoi.source(), aoi.areaHa(), aoi.wkt(), "FAILED",
                    e.getMessage(), 0, null, null, actor.userId(), actor.username());
            log.warn("Bhuvan LULC analysis failed for project {} (aoi: {}, {} ms): {}",
                    project == null ? "ad-hoc" : project.code(), aoi.source(),
                    (System.nanoTime() - started) / 1_000_000L, e.kind());
            throw e;
        }

        boolean noData = BhuvanClient.noData(body);
        List<LulcRecord> records = noData ? List.of() : parseRecords(body);
        List<LulcClass> totals = totals(records);
        List<String> years = years(records);
        BigDecimal totalArea = records.stream().map(LulcRecord::areaSqKm).filter(value -> value != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(4, RoundingMode.HALF_UP);
        String status = noData ? "NO_DATA" : "SUCCESS";
        String message = noData ? "Bhuvan returned no LULC data for this AOI" : "Bhuvan LULC response received";
        String raw;
        try {
            raw = objectMapper.writeValueAsString(body);
        } catch (tools.jackson.core.JacksonException e) {
            raw = "null";
        }
        UUID runId = repo.insertRun(project == null ? null : project.id(), project == null ? null : project.code(),
                geography == null ? null : geography.stateCode(), geography == null ? null : geography.stateName(),
                geography == null ? null : geography.districtName(), aoi.source(), aoi.areaHa(), aoi.wkt(), status, message,
                records.size(), totalArea, raw, actor.userId(), actor.username());
        if (project != null) {
            audit.record("BHUVAN_LULC_ANALYSIS", "Project", project.id(), "run=" + runId + ", aoi=" + aoi.source()
                    + ", areaHa=" + aoi.areaHa() + ", records=" + records.size() + ", areaSqKm=" + totalArea);
        } else {
            audit.record("BHUVAN_LULC_ANALYSIS", "BhuvanAnalysis", runId, "aoi=" + aoi.source()
                    + ", areaHa=" + aoi.areaHa() + ", records=" + records.size() + ", areaSqKm=" + totalArea);
        }
        log.info("Bhuvan LULC analysis {} for project {} (aoi: {}, records: {}, {} ms)",
                runId, project == null ? "ad-hoc" : project.code(), aoi.source(), records.size(),
                (System.nanoTime() - started) / 1_000_000L);
        return new LulcAnalysis(runId, project == null ? null : project.id(), project == null ? null : project.code(),
                geography == null ? null : geography.stateCode(), geography == null ? null : geography.stateName(),
                geography == null ? null : geography.districtName(), aoi.source(), aoi.areaHa(), status, message,
                Instant.now(), records, totals, years, body);
    }

    private Aoi userAoi(String wkt) {
        if (wkt.length() > MAX_WKT_CHARS) {
            throw new InvalidRequestException("The WKT AOI is too large (maximum " + MAX_WKT_CHARS + " characters)");
        }
        return repo.normaliseWkt(wkt.trim());
    }

    /**
     * The Bhuvan AOI endpoint has answered with different key spellings over time, so the mapping is deliberately
     * tolerant: the raw JSON is always kept and the common Year / LULC Description / Area keys are normalised.
     */
    static List<LulcRecord> parseRecords(JsonNode root) {
        List<JsonNode> objects = new ArrayList<>();
        if (root == null || root.isNull()) {
            return List.of();
        }
        if (root.isArray()) {
            root.forEach(node -> {
                if (node.isObject()) {
                    objects.add(node);
                }
            });
        } else if (root.isObject() && root.path("data").isArray()) {
            root.path("data").forEach(node -> {
                if (node.isObject()) {
                    objects.add(node);
                }
            });
        } else if (root.isObject()) {
            objects.add(root);
        }
        List<LulcRecord> records = new ArrayList<>();
        for (JsonNode node : objects) {
            String year = textValue(node, key -> key.equals("year"));
            String description = textValue(node, key -> (key.contains("lulc") && key.contains("description"))
                    || key.equals("description") || key.equals("landuse") || key.equals("land_use")
                    || key.equals("category") || key.equals("class"));
            BigDecimal area = areaValue(node);
            if (description == null && area == null) {
                continue;
            }
            Map<String, Object> raw = new LinkedHashMap<>();
            node.properties().forEach(entry -> raw.put(entry.getKey(), entry.getValue().isValueNode()
                    ? entry.getValue().asText() : entry.getValue().toString()));
            records.add(new LulcRecord(year, description == null ? "Unclassified" : description.trim(), area, raw));
        }
        return records;
    }

    private static String textValue(JsonNode node, java.util.function.Predicate<String> keyMatch) {
        var fields = node.properties().iterator();
        while (fields.hasNext()) {
            var entry = fields.next();
            if (keyMatch.test(entry.getKey().toLowerCase(Locale.ROOT)) && entry.getValue().isValueNode()) {
                String value = entry.getValue().asText("").trim();
                if (!value.isEmpty()) {
                    return value;
                }
            }
        }
        return null;
    }

    private static BigDecimal areaValue(JsonNode node) {
        var fields = node.properties().iterator();
        while (fields.hasNext()) {
            var entry = fields.next();
            String key = entry.getKey().toLowerCase(Locale.ROOT);
            if ((key.contains("area") || key.contains("sq")) && entry.getValue().isValueNode()) {
                String value = entry.getValue().asText("").replace(",", "").trim();
                try {
                    return new BigDecimal(value).setScale(4, RoundingMode.HALF_UP);
                } catch (NumberFormatException ignored) {
                    // Another "area" field may be descriptive text; keep looking.
                }
            }
        }
        return null;
    }

    static List<LulcClass> totals(List<LulcRecord> records) {
        Map<String, BigDecimal> area = new LinkedHashMap<>();
        Map<String, Integer> count = new LinkedHashMap<>();
        for (LulcRecord record : records) {
            area.merge(record.description(), record.areaSqKm() == null ? BigDecimal.ZERO : record.areaSqKm(), BigDecimal::add);
            count.merge(record.description(), 1, Integer::sum);
        }
        return area.entrySet().stream()
                .map(entry -> new LulcClass(entry.getKey(), entry.getValue().setScale(4, RoundingMode.HALF_UP),
                        count.getOrDefault(entry.getKey(), 0)))
                .sorted(Comparator.comparing(LulcClass::areaSqKm).reversed())
                .toList();
    }

    static List<String> years(List<LulcRecord> records) {
        return records.stream().map(LulcRecord::year).filter(value -> value != null && !value.isBlank())
                .distinct().sorted().toList();
    }

    // ------------------------------------------------------------------ history and exports

    public HistoryPage history(UUID projectId, int page, int size, CurrentActor actor) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_HISTORY_SIZE);
        if (projectId != null) {
            projects.findActiveProject(projectId).filter(value -> access.canView(actor, value.districtId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
        }
        return repo.history(projectId, safePage, safeSize);
    }

    public LulcAnalysis run(UUID id, CurrentActor actor) {
        StoredRun run = visibleRun(id, actor);
        JsonNode raw = null;
        if (run.responseJson() != null && !"null".equals(run.responseJson())) {
            try {
                raw = objectMapper.readTree(run.responseJson());
            } catch (tools.jackson.core.JacksonException e) {
                raw = null;
            }
        }
        List<LulcRecord> records = BhuvanClient.noData(raw) ? List.of() : parseRecords(raw);
        return new LulcAnalysis(run.id(), run.projectId(), run.projectCode(), run.stateCode(), run.stateName(),
                run.districtName(), run.aoiSource(), run.aoiAreaHa(), run.status(), run.message(), run.createdAt(),
                records, totals(records), years(records), raw);
    }

    private StoredRun visibleRun(UUID id, CurrentActor actor) {
        StoredRun run = repo.findRun(id).orElseThrow(() -> new ResourceNotFoundException("Analysis not found: " + id));
        if (run.projectId() != null) {
            projects.findActiveProject(run.projectId()).filter(value -> access.canView(actor, value.districtId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Analysis not found: " + id));
        }
        return run;
    }

    public record ExportFile(byte[] content, String filename, String contentType) {
    }

    public ExportFile exportCsv(UUID id, CurrentActor actor) {
        LulcAnalysis analysis = run(id, actor);
        List<String> headers = List.of("Analysis ID", "Project", "State", "District", "AOI source", "AOI area (ha)",
                "Year", "LULC description", "Area (sq km)");
        List<List<Object>> rows = new ArrayList<>();
        if (analysis.records().isEmpty()) {
            rows.add(List.of(analysis.runId().toString(), nullToEmpty(analysis.projectCode()), nullToEmpty(analysis.stateName()),
                    nullToEmpty(analysis.districtName()), analysis.aoiSource(), analysis.aoiAreaHa(), "", analysis.message(), ""));
        } else {
            for (LulcRecord record : analysis.records()) {
                rows.add(List.of(analysis.runId().toString(), nullToEmpty(analysis.projectCode()),
                        nullToEmpty(analysis.stateName()), nullToEmpty(analysis.districtName()), analysis.aoiSource(),
                        analysis.aoiAreaHa(), nullToEmpty(record.year()), record.description(), record.areaSqKm()));
            }
        }
        String csv = CsvWriter.write(headers, rows);
        return new ExportFile(csv.getBytes(StandardCharsets.UTF_8), "bhuvan-lulc-" + id + ".csv", "text/csv;charset=UTF-8");
    }

    public ExportFile exportPdf(UUID id, CurrentActor actor) {
        LulcAnalysis analysis = run(id, actor);
        List<String> lines = new ArrayList<>();
        lines.add("ISRO Bhuvan LULC AOI analysis");
        lines.add("Analysis ID: " + analysis.runId());
        lines.add("Project: " + nullToEmpty(analysis.projectCode()) + " " + nullToEmpty(analysis.projectId() == null
                ? "" : analysis.projectId().toString()));
        lines.add("State / district: " + nullToEmpty(analysis.stateName()) + " / " + nullToEmpty(analysis.districtName()));
        lines.add("AOI source: " + analysis.aoiSource() + "   AOI area: " + analysis.aoiAreaHa() + " ha");
        lines.add("Fetched at: " + analysis.fetchedAt());
        lines.add("Status: " + analysis.status() + "   " + nullToEmpty(analysis.message()));
        lines.add("");
        lines.add("Year        LULC description                 Area (sq km)");
        if (analysis.records().isEmpty()) {
            lines.add("(no rows returned by the provider)");
        } else {
            for (LulcRecord record : analysis.records()) {
                lines.add(String.format(Locale.ROOT, "%-11s %-31s %12s", nullToEmpty(record.year()),
                        record.description(), record.areaSqKm() == null ? "" : record.areaSqKm().toPlainString()));
            }
        }
        lines.add("");
        lines.add("Class totals");
        for (LulcClass total : analysis.totals()) {
            lines.add(String.format(Locale.ROOT, "%-31s %12s", total.description(), total.areaSqKm().toPlainString()));
        }
        lines.add("");
        lines.add("Source: " + PROVIDER + " API. This report is a copy of the stored provider response.");
        byte[] pdf = SimplePdfWriter.write("Bhuvan LULC analysis " + analysis.runId(), lines);
        return new ExportFile(pdf, "bhuvan-lulc-" + id + ".pdf", "application/pdf");
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    // ------------------------------------------------------------------ village lookups

    public VillageResult villageGeocode(String village, String stateCode, CurrentActor actor) {
        if (village == null || village.isBlank() || village.trim().length() < 2 || village.trim().length() > 120) {
            throw new InvalidRequestException("Enter a village name between 2 and 120 characters");
        }
        requireVillageCoverage(stateCode);
        JsonNode body = client.villageGeocode(village.trim());
        VillageResult result = villageResult(village.trim(), BhuvanClient.VILLAGE_GEOCODE_PATH, stateCode, body);
        // The village name is user-provided and may identify a person's location, so only counts are logged.
        log.info("Bhuvan village geocode for state {} returned {} record(s)", result.stateCode(), result.recordCount());
        return result;
    }

    public VillageResult villageReverse(double lat, double lon, String stateCode, CurrentActor actor) {
        if (Double.isNaN(lat) || Double.isInfinite(lat) || Double.isNaN(lon) || Double.isInfinite(lon)) {
            throw new InvalidRequestException("Latitude and longitude must be numbers");
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            throw new InvalidRequestException("Latitude must be -90..90 and longitude -180..180");
        }
        requireVillageCoverage(stateCode);
        JsonNode body = client.villageReverse(lat, lon);
        VillageResult result = villageResult(lat + "," + lon, BhuvanClient.VILLAGE_REVERSE_PATH, stateCode, body);
        // Coordinates are location data, so the lookup result is logged without them.
        log.info("Bhuvan reverse village lookup for state {} returned {} record(s)", result.stateCode(),
                result.recordCount());
        return result;
    }

    private void requireVillageCoverage(String stateCode) {
        if (!config.enabled() || !config.tokenConfigured()) {
            throw new BhuvanException(BhuvanException.Kind.NOT_CONFIGURED,
                    "Bhuvan village lookup is not enabled on this server");
        }
        String code = stateCode == null ? "" : stateCode.trim().toUpperCase(Locale.ROOT);
        if ("MH".equals(code)) {
            if (!config.maharashtraVillageVerified()) {
                throw new InvalidRequestException("Bhuvan documents village geocoding and reverse geocoding for Andhra Pradesh "
                        + "and Karnataka only. Maharashtra support has not been verified for this installation, so the call "
                        + "was not sent. Record a successful Maharashtra check and set "
                        + "LANDNEXUS_BHUVAN_MAHARASHTRA_VILLAGE_VERIFIED=true only after that check.");
            }
            return;
        }
        if (!code.isEmpty() && !config.villageDocumentedStates().contains(code)) {
            throw new InvalidRequestException("Bhuvan village lookup is configured for "
                    + String.join(", ", config.villageDocumentedStates()) + ", not " + code);
        }
    }

    private VillageResult villageResult(String query, String endpoint, String stateCode, JsonNode body) {
        boolean noData = BhuvanClient.noData(body);
        List<Map<String, Object>> records = new ArrayList<>();
        if (!noData) {
            try {
                if (body.isArray()) {
                    records = objectMapper.convertValue(body, new TypeReference<List<Map<String, Object>>>() {
                    });
                } else if (body.isObject()) {
                    records.add(objectMapper.convertValue(body, new TypeReference<Map<String, Object>>() {
                    }));
                }
            } catch (IllegalArgumentException e) {
                throw new BhuvanException(BhuvanException.Kind.BAD_RESPONSE,
                        "Bhuvan returned village data in an unexpected shape");
            }
        }
        return new VillageResult(query, endpoint, stateCode == null ? "" : stateCode.trim().toUpperCase(Locale.ROOT),
                config.maharashtraVillageVerified(), VILLAGE_COVERAGE_NOTE, records.size(), records);
    }
}

