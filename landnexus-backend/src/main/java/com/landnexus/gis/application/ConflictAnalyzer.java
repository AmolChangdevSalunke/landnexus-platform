package com.landnexus.gis.application;

import com.landnexus.gis.api.dto.ConflictDtos.AffectedParcelDto;
import com.landnexus.gis.api.dto.ConflictDtos.Finding;
import com.landnexus.gis.api.dto.ConflictDtos.Severity;
import com.landnexus.gis.infrastructure.GisReportRepository.AffectedParcel;
import com.landnexus.gis.infrastructure.GisReportRepository.CaseParcelCheck;
import com.landnexus.gis.infrastructure.GisReportRepository.Coverage;
import com.landnexus.gis.infrastructure.GisReportRepository.Overlap;
import com.landnexus.gis.infrastructure.GisReportRepository.SurveyPoint;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Turns the measured facts into findings. Deterministic and free of the database, so it is easy to test.
 * The wording says "indicator", never "violation": whether a rule applies is the competent authority's decision.
 */
public final class ConflictAnalyzer {

    public static final BigDecimal PERCENT_TOLERANCE = new BigDecimal("10");
    public static final BigDecimal MIN_DIFFERENCE_HA = new BigDecimal("0.05");
    public static final BigDecimal GPS_TOLERANCE_M = new BigDecimal("25");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal MIN_OVERLAP_HA = new BigDecimal("0.0001");

    public record Result(List<AffectedParcelDto> parcels, List<Finding> findings) {
    }

    private ConflictAnalyzer() {
    }

    public static Result analyze(UUID projectId, List<AffectedParcel> affected, List<CaseParcelCheck> caseChecks,
                                 List<Overlap> overlaps, List<SurveyPoint> points, Coverage coverage) {
        List<Finding> findings = new ArrayList<>();
        List<AffectedParcelDto> parcels = new ArrayList<>();
        Map<UUID, String> labels = new HashMap<>();
        boolean projectHasCases = !caseChecks.isEmpty() || affected.stream().anyMatch(a -> projectId.equals(a.caseProjectId()));

        if (!projectHasCases && !affected.isEmpty()) {
            findings.add(new Finding("NO_ACQUISITION_CASE_YET", Severity.INFO, null,
                    "The project has no acquisition case yet, so the parcels crossed by the corridor are not compared with a case"));
        }
        for (AffectedParcel a : affected) {
            String label = label(a.gatNumber(), a.surveyNumber());
            labels.put(a.parcelId(), label);
            List<String> flags = new ArrayList<>();
            String crossed = label + ": the corridor crosses " + plain(a.affectedHa()) + " ha";

            if ("FOREST".equals(a.classification())) {
                flags.add("FOREST_LAND");
                findings.add(new Finding("FOREST_LAND", Severity.WARNING, a.parcelId(),
                        crossed + " of forest land. Special rules may apply: confirm with the competent authority"));
            }
            if ("WATER_BODY".equals(a.landUse())) {
                flags.add("WATER_BODY");
                findings.add(new Finding("WATER_BODY", Severity.WARNING, a.parcelId(),
                        crossed + " of a water body. Special rules may apply: confirm with the competent authority"));
            }
            if ("GOVERNMENT".equals(a.classification())) {
                flags.add("GOVERNMENT_LAND");
                findings.add(new Finding("GOVERNMENT_LAND", Severity.INFO, a.parcelId(),
                        crossed + " of government land. The transfer route may differ from private land"));
            }
            if (a.caseProjectId() != null && !a.caseProjectId().equals(projectId)) {
                flags.add("IN_ANOTHER_PROJECT_CASE");
                findings.add(new Finding("IN_ANOTHER_PROJECT_CASE", Severity.WARNING, a.parcelId(),
                        label + " is part of an open acquisition case (" + a.caseNumber() + ") of another project"));
            } else if (a.caseProjectId() == null && projectHasCases) {
                flags.add("NOT_IN_ACQUISITION_CASE");
                findings.add(new Finding("NOT_IN_ACQUISITION_CASE", Severity.WARNING, a.parcelId(),
                        crossed + " but it is not identified in any acquisition case of this project"));
            } else if (a.areaToAcquireHa() != null && differs(a.areaToAcquireHa(), a.affectedHa())) {
                flags.add("AREA_TO_ACQUIRE_DIFFERS");
                findings.add(new Finding("AREA_TO_ACQUIRE_DIFFERS", Severity.INFO, a.parcelId(),
                        label + ": the case acquires " + plain(a.areaToAcquireHa()) + " ha but the corridor crosses "
                                + plain(a.affectedHa()) + " ha"));
            }
            if (a.recordedAreaHa() != null && differs(a.boundaryAreaHa(), a.recordedAreaHa())) {
                flags.add("BOUNDARY_AREA_DIFFERS_FROM_RECORD");
                findings.add(new Finding("BOUNDARY_AREA_DIFFERS_FROM_RECORD", Severity.INFO, a.parcelId(),
                        label + ": the drawn boundary is " + plain(a.boundaryAreaHa()) + " ha but the land record says "
                                + plain(a.recordedAreaHa()) + " ha"));
            }
            parcels.add(new AffectedParcelDto(a.parcelId(), a.gatNumber(), a.surveyNumber(), a.classification(), a.landUse(),
                    a.recordedAreaHa(), a.boundaryAreaHa(), a.affectedHa(), a.caseNumber(), a.areaToAcquireHa(), List.copyOf(flags)));
        }
        for (CaseParcelCheck c : caseChecks) {
            if (!c.hasBoundary()) {
                findings.add(new Finding("CASE_PARCEL_WITHOUT_BOUNDARY", Severity.INFO, c.parcelId(),
                        c.label() + " (case " + c.caseNumber() + ") has no boundary yet, so it cannot be checked against the corridor"));
            } else if (!c.crossesCorridor()) {
                findings.add(new Finding("CASE_PARCEL_OUTSIDE_CORRIDOR", Severity.WARNING, c.parcelId(),
                        c.label() + " (case " + c.caseNumber() + ") is identified for acquisition but its boundary does not touch the corridor"));
            }
        }
        for (Overlap o : overlaps) {
            if (o.overlapHa().compareTo(MIN_OVERLAP_HA) >= 0) {
                findings.add(new Finding("PARCEL_OVERLAP", Severity.WARNING, o.parcelA(),
                        "The boundaries of " + labels.getOrDefault(o.parcelA(), "a parcel") + " and "
                                + labels.getOrDefault(o.parcelB(), "another parcel") + " overlap by " + plain(o.overlapHa())
                                + " ha: one of the boundaries is probably wrong"));
            }
        }
        for (SurveyPoint p : points) {
            if (!p.inside() && p.distanceM().compareTo(GPS_TOLERANCE_M) > 0) {
                findings.add(new Finding("SURVEY_POINT_OUTSIDE_PARCEL", Severity.WARNING, p.parcelId(),
                        "The GPS point of a survey in case " + p.caseNumber() + " is " + plain(p.distanceM()) + " m outside the boundary of "
                                + labels.getOrDefault(p.parcelId(), "parcel " + p.parcelId().toString().substring(0, 8))));
            }
        }
        if (coverage.total() > coverage.withBoundary()) {
            findings.add(new Finding("PARCELS_WITHOUT_BOUNDARY", Severity.INFO, null,
                    (coverage.total() - coverage.withBoundary()) + " of " + coverage.total()
                            + " active parcels in the project's villages have no boundary yet: they cannot be checked"));
        }
        findings.sort(Comparator.comparing(Finding::severity).thenComparing(Finding::code).thenComparing(Finding::message));
        return new Result(parcels, findings);
    }

    /** More than 10% and more than 0.05 ha apart. */
    static boolean differs(BigDecimal value, BigDecimal reference) {
        BigDecimal diff = value.subtract(reference).abs();
        if (diff.compareTo(MIN_DIFFERENCE_HA) <= 0) {
            return false;
        }
        if (reference.signum() == 0) {
            return true;
        }
        return diff.multiply(HUNDRED).divide(reference, 2, RoundingMode.HALF_UP).compareTo(PERCENT_TOLERANCE) > 0;
    }

    private static String label(String gat, String survey) {
        return gat != null ? "Gat " + gat : "Survey " + survey;
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }
}