package com.landnexus.reporting.api;

import com.landnexus.reporting.api.dto.MonitoringDtos.Dashboard;
import com.landnexus.reporting.api.dto.MonitoringDtos.ReportInfo;
import com.landnexus.reporting.api.dto.MonitoringDtos.ReportResult;
import com.landnexus.reporting.application.DashboardService;
import com.landnexus.reporting.application.ReportService;
import com.landnexus.shared.security.CurrentActor;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Thin HTTP layer. The CSV download needs the Authorization header, so a browser app must fetch it as a blob. */
@RestController
@RequestMapping("/api/v1/monitoring")
public class MonitoringController {

    private final DashboardService dashboards;
    private final ReportService reports;

    public MonitoringController(DashboardService dashboards, ReportService reports) {
        this.dashboards = dashboards;
        this.reports = reports;
    }

    @PreAuthorize("hasAuthority('DASHBOARD_READ')")
    @GetMapping("/dashboard")
    public Dashboard dashboard(@RequestParam(required = false) UUID stateId, @RequestParam(required = false) UUID districtId,
                               Authentication a) {
        return dashboards.dashboard(stateId, districtId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('REPORT_READ')")
    @GetMapping("/reports")
    public List<ReportInfo> catalogue(Authentication a) {
        return reports.catalogue(CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('REPORT_READ')")
    @GetMapping("/reports/{code}")
    public ReportResult run(@PathVariable String code, @RequestParam(required = false) String status,
                            @RequestParam(required = false) UUID stateId, @RequestParam(required = false) UUID districtId,
                            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
                            Authentication a) {
        return reports.run(code, status, stateId, districtId, page, size, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('REPORT_EXPORT')")
    @GetMapping("/reports/{code}/export.csv")
    public ResponseEntity<byte[]> export(@PathVariable String code, @RequestParam(required = false) String status,
                                         @RequestParam(required = false) UUID stateId, @RequestParam(required = false) UUID districtId,
                                         Authentication a) {
        ReportService.Export file = reports.export(code, status, stateId, districtId, CurrentActor.from(a));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .contentLength(file.content().length)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(file.content());
    }
}