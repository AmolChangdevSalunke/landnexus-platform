package com.landnexus.compensation.api.dto;

import com.landnexus.compensation.domain.CompTypes.EntitlementStatus;
import com.landnexus.compensation.domain.CompTypes.PaymentStatus;
import com.landnexus.compensation.domain.CompTypes.RrBenefitKind;
import com.landnexus.compensation.domain.CompTypes.RrCaseStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PaymentRrDtos {

    private PaymentRrDtos() {
    }

    /** No bank details and no names: the beneficiary is only an id. mode is always SIMULATED. */
    public record PaymentResponse(UUID id, UUID valuationId, UUID caseId, UUID caseParcelId, UUID landownerId,
                                  BigDecimal sharePercent, BigDecimal amount, PaymentStatus status, String mode,
                                  String reference, String failureReason, int attemptCount, Instant releasedAt,
                                  Instant confirmedAt, List<String> availableActions) {
    }

    public record PaymentEventResponse(UUID id, PaymentStatus fromStatus, PaymentStatus toStatus, String event,
                                       String actorUsername, String detail, Instant occurredAt) {
    }

    /** outcome must be CONFIRMED or FAILED; a reason is required for FAILED. */
    public record SimulateRequest(@NotNull PaymentStatus outcome, @Size(max = 500) String reason) {
    }

    public record PaymentSummary(UUID caseId, String mode, int payments, BigDecimal totalAmount, BigDecimal instructedAmount,
                                 BigDecimal sentAmount, BigDecimal confirmedAmount, BigDecimal failedAmount) {
    }

    // ---------------------------------------------------------------- R&R
    public record BenefitTypeRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,39}$") String code,
                                     @NotBlank @Size(max = 100) String name, @NotNull RrBenefitKind kind,
                                     @DecimalMin("0.01") @Digits(integer = 13, fraction = 2) BigDecimal defaultAmount,
                                     @Min(1) @Max(600) Integer defaultMonths, Boolean requiresDisplaced,
                                     Boolean requiresLivelihoodLost) {
    }

    public record BenefitTypeResponse(UUID id, String code, String name, RrBenefitKind kind, BigDecimal defaultAmount,
                                      Integer defaultMonths, boolean requiresDisplaced, boolean requiresLivelihoodLost,
                                      boolean active) {
    }

//    public record RrCaseRequest(@NotNull UUID landownerId, boolean displaced, boolean livelihoodLost,
//                                @Size(max = 500) String notes) {
//    }

    public record RrCaseRequest(@NotNull UUID landownerId, @NotNull Boolean displaced, @NotNull Boolean livelihoodLost,
                                @Size(max = 500) String notes) {
    }

    public record EntitlementRequest(@NotNull UUID benefitTypeId,
                                     @DecimalMin("0.01") @Digits(integer = 13, fraction = 2) BigDecimal amount,
                                     @Min(1) @Max(600) Integer months) {
    }

    public record DeliverRequest(@NotNull @PastOrPresent LocalDate deliveredOn, @Size(max = 500) String remarks) {
    }

    public record EntitlementResponse(UUID id, String benefitCode, String benefitName, RrBenefitKind kind,
                                      BigDecimal amount, Integer months, EntitlementStatus status, LocalDate deliveredOn,
                                      String deliveryRemarks) {
    }

    public record RrCaseResponse(UUID id, UUID caseId, UUID landownerId, boolean displaced, boolean livelihoodLost,
                                 RrCaseStatus status, String notes, UUID createdByUserId, UUID approvedByUserId,
                                 Instant decidedAt, List<EntitlementResponse> entitlements, List<String> availableActions) {
    }
}