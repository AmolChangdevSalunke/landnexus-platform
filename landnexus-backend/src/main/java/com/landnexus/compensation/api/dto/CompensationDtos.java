package com.landnexus.compensation.api.dto;

import com.landnexus.compensation.domain.CompTypes.AssetCategory;
import com.landnexus.compensation.domain.CompTypes.ComponentType;
import com.landnexus.compensation.domain.CompTypes.RateStatus;
import com.landnexus.compensation.domain.CompTypes.RuleSetStatus;
import com.landnexus.compensation.domain.CompTypes.ValuationStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class CompensationDtos {

    private CompensationDtos() {
    }

    public record Remarks(@Size(max = 1000) String remarks) {
    }

    // ---------------------------------------------------------------- rates
    public record RateRequest(@NotNull UUID villageId, @NotBlank String classification,
                              @NotNull @DecimalMin("0.01") @Digits(integer = 13, fraction = 2) BigDecimal ratePerHa,
                              @NotNull LocalDate effectiveFrom, @Size(max = 200) String sourceNote) {
    }

    public record RateResponse(UUID id, UUID villageId, UUID districtId, String classification, BigDecimal ratePerHa,
                               LocalDate effectiveFrom, String sourceNote, RateStatus status, UUID createdByUserId,
                               UUID approvedByUserId, Instant decidedAt, String decisionRemarks) {
    }

    // ---------------------------------------------------------------- rule sets
    /** baseCodes: for PERCENT_OF, the codes of EARLIER components it is a percentage of. factor is ignored for ASSET_VALUE. */
    public record ComponentRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,39}$") String code,
                                   @NotBlank @Size(max = 100) String name, @NotNull ComponentType type,
                                   @Digits(integer = 9, fraction = 6) BigDecimal factor, List<@NotBlank String> baseCodes) {
    }

    public record RuleSetRequest(@NotBlank @Size(max = 100) String name, @NotBlank String framework, UUID stateId,
                                 UUID districtId, @NotNull LocalDate effectiveFrom, LocalDate effectiveTo,
                                 @Size(max = 500) String description,
                                 @NotEmpty @Size(max = 20) List<@Valid @NotNull ComponentRequest> components) {
    }

    public record ComponentResponse(int position, String code, String name, ComponentType type, BigDecimal factor,
                                    List<String> baseCodes) {
    }

    public record RuleSetResponse(UUID id, String name, int version, String framework, UUID stateId, UUID districtId,
                                  LocalDate effectiveFrom, LocalDate effectiveTo, String description, RuleSetStatus status,
                                  UUID createdByUserId, UUID approvedByUserId, Instant approvedAt, String retireReason,
                                  List<ComponentResponse> components) {
    }

    // ---------------------------------------------------------------- assets
    public record AssetRequest(@NotNull AssetCategory category, @NotBlank @Size(max = 200) String description,
                               @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal quantity,
                               @NotBlank @Size(max = 20) String unit,
                               @NotNull @DecimalMin("0.01") @Digits(integer = 13, fraction = 2) BigDecimal unitValue) {
    }

    public record AssetResponse(UUID id, UUID caseParcelId, AssetCategory category, String description, BigDecimal quantity,
                                String unit, BigDecimal unitValue, BigDecimal value, boolean voided, String voidReason) {
    }

    public record VoidRequest(@NotBlank @Size(max = 500) String reason) {
    }

    // ---------------------------------------------------------------- valuations
    public record LineResponse(int position, String code, String name, ComponentType type, String basis, BigDecimal amount) {
    }

    /** availableActions: SUBMIT and RECALCULATE for a draft; APPROVE and REJECT for a submitted estimate (not the preparer). */
    public record ValuationResponse(UUID id, UUID caseId, UUID caseParcelId, UUID parcelId, int versionNo,
                                    BigDecimal awardedAreaHa, String classification, BigDecimal ratePerHa,
                                    String ruleSetName, int ruleSetVersion, LocalDate referenceDate, BigDecimal assetTotal,
                                    BigDecimal totalAmount, ValuationStatus status, String preparedByUsername,
                                    UUID decidedByUserId, Instant decidedAt, String decisionRemarks, Instant createdAt,
                                    List<LineResponse> lines, List<String> availableActions) {
    }

    public record SummaryRow(UUID caseParcelId, UUID parcelId, BigDecimal awardedAreaHa, String estimateStatus,
                             UUID valuationId, BigDecimal totalAmount) {
    }

    /** estimateStatus per parcel: NOT_ESTIMATED, DRAFT, SUBMITTED or APPROVED. approvedTotal sums only approved estimates. */
    public record CompensationSummary(UUID caseId, String caseNumber, int parcels, int approved, int submitted, int draft,
                                      int notEstimated, BigDecimal approvedTotal, List<SummaryRow> rows) {
    }
}