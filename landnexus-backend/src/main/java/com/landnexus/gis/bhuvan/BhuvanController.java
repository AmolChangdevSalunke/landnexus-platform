package com.landnexus.gis.bhuvan;

import com.landnexus.gis.bhuvan.BhuvanClient.BhuvanException;
import com.landnexus.gis.bhuvan.BhuvanDtos.ErrorBody;
import com.landnexus.gis.bhuvan.BhuvanDtos.HistoryPage;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcAnalysis;
import com.landnexus.gis.bhuvan.BhuvanDtos.LulcAoiRequest;
import com.landnexus.gis.bhuvan.BhuvanDtos.Status;
import com.landnexus.gis.bhuvan.BhuvanDtos.VillageResult;
import com.landnexus.gis.bhuvan.BhuvanService.ExportFile;
import com.landnexus.shared.security.CurrentActor;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bhuvan endpoints. The token lives only in the backend configuration and never crosses this boundary. Requests need
 * GIS_READ and project-based calls are filtered by the caller's geographic scope.
 */
@RestController
@RequestMapping("/api/v1/gis/bhuvan")
public class BhuvanController {

    private final BhuvanService service;

    public BhuvanController(BhuvanService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/status")
    public Status status() {
        return service.status();
    }

    /** Uses a project's current corridor as the AOI, or a WKT Polygon supplied in the body. */
    @PreAuthorize("hasAuthority('GIS_READ')")
    @PostMapping(path = "/lulc/aoi", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> analyze(@RequestBody LulcAoiRequest request, Authentication a) {
        try {
            return ResponseEntity.ok(service.analyse(request.projectId(), request.wkt(), CurrentActor.from(a)));
        } catch (BhuvanException e) {
            return providerError(e);
        }
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/history")
    public HistoryPage history(@RequestParam(required = false) UUID projectId,
                               @RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "20") int size, Authentication a) {
        return service.history(projectId, page, size, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/history/{id}")
    public ResponseEntity<?> run(@PathVariable UUID id, Authentication a) {
        try {
            return ResponseEntity.ok(service.run(id, CurrentActor.from(a)));
        } catch (BhuvanException e) {
            return providerError(e);
        }
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/history/{id}/export.csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable UUID id, Authentication a) {
        return download(service.exportCsv(id, CurrentActor.from(a)));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/history/{id}/export.pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable UUID id, Authentication a) {
        return download(service.exportPdf(id, CurrentActor.from(a)));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/villages/geocode")
    public ResponseEntity<?> villageGeocode(@RequestParam String village,
                                            @RequestParam(required = false) String stateCode,
                                            Authentication a) {
        try {
            return ResponseEntity.ok(service.villageGeocode(village, stateCode, CurrentActor.from(a)));
        } catch (BhuvanException e) {
            return providerError(e);
        }
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/villages/reverse")
    public ResponseEntity<?> villageReverse(@RequestParam double lat, @RequestParam double lon,
                                            @RequestParam(required = false) String stateCode,
                                            Authentication a) {
        try {
            return ResponseEntity.ok(service.villageReverse(lat, lon, stateCode, CurrentActor.from(a)));
        } catch (BhuvanException e) {
            return providerError(e);
        }
    }

    private static ResponseEntity<byte[]> download(ExportFile file) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(file.content().length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(file.content());
    }

    private static ResponseEntity<ErrorBody> providerError(BhuvanException exception) {
        Map<String, Object> details = new LinkedHashMap<>();
        if (exception.providerStatus() != null) {
            details.put("providerStatus", exception.providerStatus());
        }
        ErrorBody body = new ErrorBody(exception.httpStatus(), exception.kind().name(), exception.providerStatus(),
                exception.getMessage(), details);
        return ResponseEntity.status(exception.httpStatus()).contentType(MediaType.APPLICATION_JSON).body(body);
    }
}
