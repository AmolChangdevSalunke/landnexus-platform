package com.landnexus.gis.api.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** The spatial conflict report. Indicators for an officer's review, never a legal decision. */
public final class ConflictDtos {

    private ConflictDtos() {
    }

    public enum Severity { WARNING, INFO }

    public record Finding(String code, Severity severity, UUID parcelId, String message) {
    }

    public record AffectedParcelDto(UUID parcelId, String gatNumber, String surveyNumber, String classification,
                                    String landUse, BigDecimal recordedAreaHa, BigDecimal boundaryAreaHa,
                                    BigDecimal affectedHa, String caseNumber, BigDecimal areaToAcquireHa, List<String> flags) {
    }

    public record ConflictReport(UUID projectId, String projectCode, int alignmentVersion, int corridorWidthM,
                                 BigDecimal corridorAreaHa, long parcelsInProjectVillages, long parcelsWithBoundary,
                                 int affectedParcelCount, BigDecimal totalAffectedHa, int warnings, int infos,
                                 List<AffectedParcelDto> affectedParcels, List<Finding> findings, List<String> limitations) {
    }
}