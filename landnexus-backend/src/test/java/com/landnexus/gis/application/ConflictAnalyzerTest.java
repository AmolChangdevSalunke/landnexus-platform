package com.landnexus.gis.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.landnexus.gis.api.dto.ConflictDtos.Finding;
import com.landnexus.gis.api.dto.ConflictDtos.Severity;
import com.landnexus.gis.infrastructure.GisReportRepository.AffectedParcel;
import com.landnexus.gis.infrastructure.GisReportRepository.CaseParcelCheck;
import com.landnexus.gis.infrastructure.GisReportRepository.Coverage;
import com.landnexus.gis.infrastructure.GisReportRepository.Overlap;
import com.landnexus.gis.infrastructure.GisReportRepository.SurveyPoint;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ConflictAnalyzerTest {

    private final UUID project = UUID.randomUUID();
    private final Coverage fullCoverage = new Coverage(3, 3);

    private AffectedParcel parcel(UUID id, String gat, String classification, String landUse, String recorded, String boundary,
                                  String affected, UUID caseProject, String caseNo, String toAcquire) {
        return new AffectedParcel(id, gat, null, classification, landUse, new BigDecimal(recorded), new BigDecimal(boundary),
                new BigDecimal(affected), caseProject, caseNo, toAcquire == null ? null : new BigDecimal(toAcquire));
    }

    private AffectedParcel plain(UUID id, String gat, UUID caseProject, String caseNo, String toAcquire) {
        return parcel(id, gat, "AGRICULTURAL_DRY", "CULTIVATION", "1.00", "1.00", "0.60", caseProject, caseNo, toAcquire);
    }

    private static List<String> codes(ConflictAnalyzer.Result r) {
        return r.findings().stream().map(Finding::code).toList();
    }

    private static CaseParcelCheck caseCheck(boolean hasBoundary, boolean crosses) {
        return new CaseParcelCheck(UUID.randomUUID(), "ACQ-1", "Gat 9", hasBoundary, crosses);
    }

    @Test
    void forestWaterAndGovernmentLand_areFlagged_withCautiousWording() {
        ConflictAnalyzer.Result r = ConflictAnalyzer.analyze(project, List.of(
                        parcel(UUID.randomUUID(), "1", "FOREST", "VACANT", "1.00", "1.00", "0.60", null, null, null),
                        parcel(UUID.randomUUID(), "2", "OTHER", "WATER_BODY", "1.00", "1.00", "0.60", null, null, null),
                        parcel(UUID.randomUUID(), "3", "GOVERNMENT", "VACANT", "1.00", "1.00", "0.60", null, null, null)),
                List.of(), List.of(), List.of(), fullCoverage);

        assertThat(codes(r)).contains("FOREST_LAND", "WATER_BODY", "GOVERNMENT_LAND");
        assertThat(r.findings().stream().filter(f -> f.code().equals("FOREST_LAND")).findFirst().orElseThrow().message())
                .contains("confirm with the competent authority");
        assertThat(r.parcels().get(0).flags()).contains("FOREST_LAND");
    }

    @Test
    void withoutAnyCase_oneInfoReplacesAWarningPerParcel() {
        ConflictAnalyzer.Result r = ConflictAnalyzer.analyze(project,
                List.of(plain(UUID.randomUUID(), "1", null, null, null), plain(UUID.randomUUID(), "2", null, null, null)),
                List.of(), List.of(), List.of(), fullCoverage);

        assertThat(codes(r)).containsExactly("NO_ACQUISITION_CASE_YET");
        assertThat(r.findings().get(0).severity()).isEqualTo(Severity.INFO);
    }

    @Test
    void aParcelOutsideTheCase_orInAnotherProjectsCase_isAWarning() {
        UUID other = UUID.randomUUID();
        ConflictAnalyzer.Result r = ConflictAnalyzer.analyze(project, List.of(
                        plain(UUID.randomUUID(), "1", project, "ACQ-1", "0.60"),
                        plain(UUID.randomUUID(), "2", null, null, null),
                        plain(UUID.randomUUID(), "3", other, "ACQ-9", "0.60")),
                List.of(caseCheck(true, true)), List.of(), List.of(), fullCoverage);

        assertThat(codes(r)).contains("NOT_IN_ACQUISITION_CASE", "IN_ANOTHER_PROJECT_CASE");
        assertThat(r.findings().stream().filter(f -> f.severity() == Severity.WARNING)).hasSize(2);
    }

    @Test
    void areaDifferences_needMoreThanTenPercentAndMoreThanFiveAres() {
        UUID id = UUID.randomUUID();
        // case acquires 1.00 ha while the corridor crosses 0.60 ha: differs; recorded 1.00 vs drawn 1.40: differs
        ConflictAnalyzer.Result differs = ConflictAnalyzer.analyze(project,
                List.of(parcel(id, "1", "OTHER", "VACANT", "1.00", "1.40", "0.60", project, "ACQ-1", "1.00")),
                List.of(caseCheck(true, true)), List.of(), List.of(), fullCoverage);
        assertThat(codes(differs)).contains("AREA_TO_ACQUIRE_DIFFERS", "BOUNDARY_AREA_DIFFERS_FROM_RECORD");

        ConflictAnalyzer.Result close = ConflictAnalyzer.analyze(project,
                List.of(parcel(id, "1", "OTHER", "VACANT", "1.00", "1.04", "0.60", project, "ACQ-1", "0.62")),
                List.of(caseCheck(true, true)), List.of(), List.of(), fullCoverage);
        assertThat(codes(close)).isEmpty();

        assertThat(ConflictAnalyzer.differs(new BigDecimal("0.03"), new BigDecimal("0.01"))).isFalse();
        assertThat(ConflictAnalyzer.differs(new BigDecimal("0.30"), BigDecimal.ZERO)).isTrue();
    }

    @Test
    void caseParcelsOutsideTheCorridorOrWithoutBoundary_areReported() {
        ConflictAnalyzer.Result r = ConflictAnalyzer.analyze(project, List.of(), List.of(caseCheck(true, false), caseCheck(false, false)),
                List.of(), List.of(), fullCoverage);

        assertThat(codes(r)).containsExactlyInAnyOrder("CASE_PARCEL_OUTSIDE_CORRIDOR", "CASE_PARCEL_WITHOUT_BOUNDARY");
    }

    @Test
    void overlapsSurveyPointsAndMissingBoundaries_areReported() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        ConflictAnalyzer.Result r = ConflictAnalyzer.analyze(project,
                List.of(plain(a, "101", project, "ACQ-1", "0.60"), plain(b, "102", project, "ACQ-1", "0.60")),
                List.of(caseCheck(true, true)),
                List.of(new Overlap(a, b, new BigDecimal("0.28"))),
                List.of(new SurveyPoint(UUID.randomUUID(), a, "ACQ-1", false, new BigDecimal("80.5")),
                        new SurveyPoint(UUID.randomUUID(), b, "ACQ-1", false, new BigDecimal("10.0")),
                        new SurveyPoint(UUID.randomUUID(), b, "ACQ-1", true, BigDecimal.ZERO)),
                new Coverage(5, 2));

        assertThat(codes(r)).contains("PARCEL_OVERLAP", "SURVEY_POINT_OUTSIDE_PARCEL", "PARCELS_WITHOUT_BOUNDARY");
        assertThat(codes(r).stream().filter("SURVEY_POINT_OUTSIDE_PARCEL"::equals)).hasSize(1);
        assertThat(r.findings().stream().filter(f -> f.code().equals("PARCEL_OVERLAP")).findFirst().orElseThrow().message())
                .contains("Gat 101").contains("Gat 102");
        assertThat(r.findings().stream().filter(f -> f.code().equals("PARCELS_WITHOUT_BOUNDARY")).findFirst().orElseThrow().message())
                .contains("3 of 5");
    }

    @Test
    void warningsComeBeforeInfos() {
        ConflictAnalyzer.Result r = ConflictAnalyzer.analyze(project,
                List.of(parcel(UUID.randomUUID(), "1", "FOREST", "VACANT", "1.00", "1.00", "0.60", null, null, null)),
                List.of(), List.of(), List.of(), new Coverage(4, 1));

        assertThat(r.findings().get(0).severity()).isEqualTo(Severity.WARNING);
        assertThat(r.findings().get(r.findings().size() - 1).severity()).isEqualTo(Severity.INFO);
    }
}