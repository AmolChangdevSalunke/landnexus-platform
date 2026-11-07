package com.landnexus.acquisition.api.dto;

import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.AcquisitionFramework;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.SurveyStatus;
import com.landnexus.acquisition.domain.CaseStatusHistory;
import com.landnexus.acquisition.domain.FieldSurvey;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

public final class AcquisitionDtos {

    private AcquisitionDtos() {
    }

    public record CaseRequest(@NotNull UUID projectId, @NotNull AcquisitionFramework framework,
                              @Size(max = 300) String frameworkNote, @Size(max = 1000) String description) {
    }

    /** availableActions lists what the caller may do now; drive the buttons from it. */
    public record CaseResponse(UUID id, String caseNumber, UUID projectId, UUID stateId, UUID districtId,
                               AcquisitionFramework framework, String frameworkNote, String description,
                               CaseStatus status, Set<UUID> villageIds, Instant createdAt, Instant updatedAt,
                               List<String> availableActions) {
        public static CaseResponse from(AcquisitionCase c, List<String> actions) {
            return new CaseResponse(c.getId(), c.getCaseNumber(), c.getProjectId(), c.getStateId(), c.getDistrictId(),
                    c.getFramework(), c.getFrameworkNote(), c.getDescription(), c.getStatus(),
                    new TreeSet<>(c.getVillageIds()), c.getCreatedAt(), c.getUpdatedAt(), actions);
        }
    }

    public record VillagesRequest(@NotEmpty @Size(max = 500) Set<@NotNull UUID> villageIds) {
    }

    public record ParcelIdentifyRequest(@NotNull UUID parcelId,
                                        @NotNull @DecimalMin("0.0001") @Digits(integer = 8, fraction = 4) BigDecimal areaToAcquireHa) {
    }

    public record AssignRequest(@NotNull UUID surveyorUserId) {
    }

    public record ReasonRequest(@Size(max = 1000) String reason) {
    }

    public record DecisionRequest(@Size(max = 500) String remarks) {
    }

    public record OwnerShareDto(UUID landownerId, BigDecimal sharePercent) {
    }

    /** owners = the snapshot taken when the parcel was identified (ids only; names come from the audited landowner API). */
    public record CaseParcelResponse(UUID id, UUID caseId, UUID parcelId, UUID villageId, BigDecimal areaToAcquireHa,
                                     UUID assignedSurveyorUserId, SurveyStatus surveyStatus, List<OwnerShareDto> owners,
                                     Instant identifiedAt) {
    }

    public record SurveyRequest(
            @NotNull @PastOrPresent LocalDate surveyedOn,
            @NotNull @DecimalMin("0.0001") @Digits(integer = 8, fraction = 4) BigDecimal measuredAreaHa,
            @NotNull @DecimalMin("-90") @DecimalMax("90") @Digits(integer = 2, fraction = 6) BigDecimal gpsLatitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") @Digits(integer = 3, fraction = 6) BigDecimal gpsLongitude,
            @Size(max = 2000) String fieldNotes) {
    }

    public record SurveyResponse(UUID id, UUID caseId, UUID caseParcelId, String surveyorUsername, LocalDate surveyedOn,
                                 BigDecimal measuredAreaHa, BigDecimal recordedAreaHa, BigDecimal variancePercent,
                                 BigDecimal gpsLatitude, BigDecimal gpsLongitude, String fieldNotes, SurveyStatus status,
                                 UUID verifiedByUserId, Instant verifiedAt, String verificationRemarks, Instant createdAt) {
        public static SurveyResponse from(FieldSurvey s) {
            return new SurveyResponse(s.getId(), s.getCaseId(), s.getCaseParcelId(), s.getSurveyorUsername(),
                    s.getSurveyedOn(), s.getMeasuredAreaHa(), s.getRecordedAreaHa(), s.getVariancePercent(),
                    s.getGpsLatitude(), s.getGpsLongitude(), s.getFieldNotes(), s.getStatus(), s.getVerifiedByUserId(),
                    s.getVerifiedAt(), s.getVerificationRemarks(), s.getCreatedAt());
        }
    }

    public record HistoryEntry(UUID id, CaseStatus fromStatus, CaseStatus toStatus, String action,
                               String actorUsername, String reason, Instant occurredAt) {
        public static HistoryEntry from(CaseStatusHistory h) {
            return new HistoryEntry(h.getId(), h.getFromStatus(), h.getToStatus(), h.getAction(), h.getActorUsername(),
                    h.getReason(), h.getOccurredAt());
        }
    }

    public record ParcelReportRow(UUID caseParcelId, UUID parcelId, BigDecimal recordedAreaHa, BigDecimal areaToAcquireHa,
                                  String surveyState, BigDecimal measuredAreaHa, BigDecimal variancePercent,
                                  BigDecimal gpsLatitude, BigDecimal gpsLongitude, String surveyorUsername,
                                  Instant verifiedAt) {
    }

    /** surveyState per parcel: VERIFIED, AWAITING_VERIFICATION, REJECTED_ONLY or NOT_SURVEYED. */
    public record VerificationReport(UUID caseId, String caseNumber, CaseStatus status, int totalParcels, int verified,
                                     int awaitingVerification, int rejectedOnly, int notSurveyed,
                                     BigDecimal totalAreaToAcquireHa, List<ParcelReportRow> parcels) {
    }
}