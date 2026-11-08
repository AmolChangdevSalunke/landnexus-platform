package com.landnexus.reporting.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** References are case or project codes and counts: no personal data. */
public final class SlaDtos {

    private SlaDtos() {
    }

    public record SlaTypeSummary(String itemType, String title, long onTime, long warning, long breach, int warnAfterHours,
                                 int breachAfterHours, String responsibleRole) {
    }

    /** level: WARNING or BREACH. entityType for a link = itemType (the id is the proposal, document, survey, objection, case, estimate or payment). */
    public record SlaItem(String itemType, String title, UUID entityId, String reference, UUID districtId, Instant since,
                          long ageHours, String level, String responsibleRole) {
    }

    public record SlaOverview(Instant generatedAt, long onTime, long warning, long breach, List<SlaTypeSummary> byType,
                              List<SlaItem> items, boolean itemsTruncated, List<String> notes) {
    }

    public record SlaRuleDto(UUID id, String itemType, String title, int warnAfterHours, int breachAfterHours,
                             String responsibleRole, String escalateRole, boolean active, String note, long rowVersion) {
    }

    /** rowVersion must be the one last read: a stale value gives 409. Hours: 0 to 8760, and the breach limit must be longer. */
    public record SlaRuleRequest(@NotNull @Min(0) @Max(8760) Integer warnAfterHours, @NotNull @Min(1) @Max(8760) Integer breachAfterHours,
                                 @NotBlank @Size(max = 40) String responsibleRole, @Size(max = 40) String escalateRole,
                                 @NotNull Boolean active, @NotNull Long rowVersion) {
    }

    public record ScanResult(Instant scannedAt, int warningsRaised, int breachesRaised, int notificationsSent) {
    }

    public record EscalationDto(UUID id, String itemType, UUID entityId, String reference, String level, int thresholdHours,
                                Instant since, String responsibleRole, String escalateRole, String triggeredBy, Instant createdAt) {
    }

    public record EscalationPage(List<EscalationDto> rows, int page, int size, long totalRows) {
    }

    public record SettingsDto(String paymentMode, long maxUploadMb, List<String> allowedUploadTypes, int exportMaxRows,
                              boolean slaSchedulerEnabled, long slaScanIntervalMinutes, String businessTimeZone, List<String> notes) {
    }
}