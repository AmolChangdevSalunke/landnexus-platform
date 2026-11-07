package com.landnexus.acquisition.api.dto;

import com.landnexus.acquisition.domain.AcquisitionTypes.NoticeType;
import com.landnexus.acquisition.domain.AcquisitionTypes.ObjectionStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.PossessionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class LifecycleDtos {

    private LifecycleDtos() {
    }

    /** objectionDeadline is mandatory for a PRELIMINARY_NOTIFICATION. issuedOn may be in the past (already published). */
    public record NoticeRequest(@NotNull NoticeType noticeType, @NotBlank @Size(max = 60) String referenceNumber,
                                @NotNull @PastOrPresent LocalDate issuedOn, LocalDate objectionDeadline,
                                @Size(max = 1000) String description) {
    }

    public record NoticeResponse(UUID id, UUID caseId, NoticeType noticeType, String referenceNumber, LocalDate issuedOn,
                                 LocalDate objectionDeadline, String description, String createdBy) {
    }

    public record ObjectionRequest(@NotNull UUID caseParcelId, @NotNull @PastOrPresent LocalDate receivedOn,
                                   @NotBlank @Size(max = 2000) String grounds, @Size(max = 200) String objectorReference) {
    }

    /** objectorReference is null for callers without LANDOWNER_READ (personal data is masked). */
    public record ObjectionResponse(UUID id, UUID caseId, UUID caseParcelId, String objectionNumber, LocalDate receivedOn,
                                    String grounds, String objectorReference, ObjectionStatus status,
                                    UUID registeredByUserId, UUID decidedByUserId, Instant decidedAt, String decisionRemarks) {
    }

    /** outcome must be ACCEPTED or DISMISSED. */
    public record ObjectionDecisionRequest(@NotNull ObjectionStatus outcome, @NotBlank @Size(max = 1000) String remarks) {
    }

    public record DeclareAwardRequest(@NotBlank @Size(max = 40) String awardNumber, @NotNull @PastOrPresent LocalDate awardDate,
                                      @Size(max = 1000) String remarks) {
    }

    public record AwardLine(UUID caseParcelId, UUID parcelId, BigDecimal awardedAreaHa) {
    }

    public record AwardResponse(UUID id, UUID caseId, String awardNumber, LocalDate awardDate, String remarks,
                                UUID declaredByUserId, List<AwardLine> lines) {
    }

    public record PossessionRequest(@NotNull UUID caseParcelId, @NotNull @PastOrPresent LocalDate possessionDate,
                                    @NotNull PossessionType possessionType, @Size(max = 500) String remarks) {
    }

    public record PossessionResponse(UUID id, UUID caseId, UUID caseParcelId, LocalDate possessionDate,
                                     PossessionType possessionType, String remarks, UUID recordedByUserId) {
    }

    public record PhotoResponse(UUID id, UUID surveyId, String originalFilename, String contentType, long sizeBytes,
                                String sha256, BigDecimal gpsLatitude, BigDecimal gpsLongitude, Instant capturedAt,
                                String uploadedByUsername, Instant uploadedAt) {
    }
}