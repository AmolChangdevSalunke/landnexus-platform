package com.landnexus.reporting.application;

import com.landnexus.reporting.api.dto.MonitoringDtos.Column;
import com.landnexus.reporting.api.dto.MonitoringDtos.ReportInfo;
import com.landnexus.reporting.api.dto.MonitoringDtos.ReportResult;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.ReportRepository;
import com.landnexus.reporting.infrastructure.ReportRepository.RowPage;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The MIS report catalogue. Reports read only the rpt_* views, only inside the caller's scope; exports are audited. */
@Service
@Transactional(readOnly = true)
public class ReportService {

    public static final int MAX_EXPORT_ROWS = 10_000;
    private static final int MAX_PAGE_SIZE = 200;
    private static final Pattern STATUS = Pattern.compile("^[A-Z][A-Z_]{0,39}$");
    private static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");

    public record Export(String filename, byte[] content) {
    }

    private record Def(String code, String title, String description, String view, String extraPermission,
                       List<Column> columns, String statusColumn, String orderBy) {
    }

    private static Column col(String key, String label, String type) {
        return new Column(key, label, type);
    }

    private static final List<Def> DEFS = List.of(
            new Def("PROJECTS", "Projects", "Approved government projects with their status and estimated land area", "rpt_projects", null,
                    List.of(col("project_code", "Project code", "TEXT"), col("title", "Title", "TEXT"), col("project_type", "Type", "TEXT"),
                            col("status", "Status", "TEXT"), col("state_name", "State", "TEXT"), col("district_name", "District", "TEXT"),
                            col("estimated_land_area_ha", "Estimated land (ha)", "NUMBER"), col("approved_at", "Approved at", "DATE")),
                    "status", "approved_at DESC NULLS LAST, id"),
            new Def("ACQUISITION_CASES", "Acquisition cases", "Acquisition cases with parcels, area, verified surveys, open objections and possessions",
                    "rpt_cases", null,
                    List.of(col("case_number", "Case number", "TEXT"), col("project_code", "Project code", "TEXT"), col("district_name", "District", "TEXT"),
                            col("framework", "Legal framework", "TEXT"), col("status", "Status", "TEXT"), col("parcels", "Parcels", "NUMBER"),
                            col("area_to_acquire_ha", "Area to acquire (ha)", "NUMBER"), col("surveys_verified", "Surveys verified", "NUMBER"),
                            col("open_objections", "Open objections", "NUMBER"), col("possessions", "Possessions", "NUMBER"),
                            col("created_at", "Opened at", "DATE")),
                    "status", "created_at DESC, id"),
            new Def("COMPENSATION", "Compensation estimates", "Compensation estimates per parcel and the amount confirmed as paid in simulation",
                    "rpt_compensation", "VALUATION_READ",
                    List.of(col("case_number", "Case number", "TEXT"), col("district_name", "District", "TEXT"), col("parcel_label", "Parcel", "TEXT"),
                            col("version_no", "Version", "NUMBER"), col("estimate_status", "Estimate status", "TEXT"),
                            col("total_amount", "Estimated total (INR)", "MONEY"), col("confirmed_amount", "Confirmed as paid, simulated (INR)", "MONEY")),
                    "estimate_status", "case_number, parcel_label, version_no, id"));

    private final ReportRepository repo;
    private final ReportingScope scopes;
    private final AuditService audit;
    private final Clock clock;

    public ReportService(ReportRepository repo, ReportingScope scopes, AuditService audit, Clock clock) {
        this.repo = repo;
        this.scopes = scopes;
        this.audit = audit;
        this.clock = clock;
    }

    /** Only the reports the caller may run. */
    public List<ReportInfo> catalogue(CurrentActor actor) {
        return DEFS.stream().filter(d -> allowed(d, actor)).map(d -> new ReportInfo(d.code(), d.title(), d.description(), d.columns())).toList();
    }

    public ReportResult run(String code, String status, UUID stateId, UUID districtId, int page, int size, CurrentActor actor) {
        Def def = find(code, actor);
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("page must be 0 or more and size between 1 and " + MAX_PAGE_SIZE);
        }
        DistrictScope scope = scopes.resolve(actor, stateId, districtId);
        RowPage result = repo.run(def.view(), keys(def), def.statusColumn(), checkedStatus(status), scope, def.orderBy(), size, page * size);
        return new ReportResult(def.code(), def.title(), def.columns(), result.rows(), page, size, result.total());
    }

    /** A CSV of the whole report. It refuses (rather than silently cuts) a report above the row limit. */
    @Transactional
    public Export export(String code, String status, UUID stateId, UUID districtId, CurrentActor actor) {
        Def def = find(code, actor);
        DistrictScope scope = scopes.resolve(actor, stateId, districtId);
        RowPage result = repo.run(def.view(), keys(def), def.statusColumn(), checkedStatus(status), scope, def.orderBy(), MAX_EXPORT_ROWS, 0);
        if (result.total() > MAX_EXPORT_ROWS) {
            throw new InvalidRequestException("The report has " + result.total() + " rows; narrow it with a state, district or status filter (maximum "
                    + MAX_EXPORT_ROWS + " rows per export)");
        }
        List<List<Object>> rows = new ArrayList<>();
        for (Map<String, Object> row : result.rows()) {
            List<Object> cells = new ArrayList<>();
            for (Column c : def.columns()) {
                cells.add(row.get(c.key()));
            }
            rows.add(cells);
        }
        String csv = CsvWriter.write(def.columns().stream().map(Column::label).toList(), rows);
        audit.record("EXPORT_REPORT", "Report", null, "report=" + def.code() + ", rows=" + rows.size() + ", status=" + status
                + ", stateId=" + stateId + ", districtId=" + districtId);
        String filename = def.code().toLowerCase(Locale.ROOT).replace('_', '-') + "-" + LocalDate.now(clock.withZone(INDIA)) + ".csv";
        return new Export(filename, csv.getBytes(StandardCharsets.UTF_8));
    }

    private Def find(String code, CurrentActor actor) {
        Def def = DEFS.stream().filter(d -> d.code().equals(code)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Report not found: " + code));
        if (!allowed(def, actor)) {
            throw new AccessDeniedException("This report needs the " + def.extraPermission() + " permission");
        }
        return def;
    }

    private static boolean allowed(Def def, CurrentActor actor) {
        return def.extraPermission() == null || actor.hasAuthority(def.extraPermission());
    }

    private static List<String> keys(Def def) {
        return def.columns().stream().map(Column::key).toList();
    }

    private static String checkedStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        if (!STATUS.matcher(status).matches()) {
            throw new InvalidRequestException("The status filter must be capital letters and underscores only");
        }
        return status;
    }
}