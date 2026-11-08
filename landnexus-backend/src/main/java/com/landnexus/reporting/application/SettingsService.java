package com.landnexus.reporting.application;

import com.landnexus.reporting.api.dto.SlaDtos.SettingsDto;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Read-only view of the settings that come from the deployment, plus honest notes. Only SLA limits are editable in the application. */
@Service
public class SettingsService {

    private final String paymentMode;
    private final long maxFileBytes;
    private final boolean schedulerEnabled;
    private final long scanIntervalMs;

    public SettingsService(@Value("${landnexus.payments.mode:SIMULATED}") String paymentMode,
                           @Value("${landnexus.storage.max-file-bytes:10485760}") long maxFileBytes,
                           @Value("${landnexus.sla.scheduler.enabled:false}") boolean schedulerEnabled,
                           @Value("${landnexus.sla.scan-interval-ms:900000}") long scanIntervalMs) {
        this.paymentMode = paymentMode;
        this.maxFileBytes = maxFileBytes;
        this.schedulerEnabled = schedulerEnabled;
        this.scanIntervalMs = scanIntervalMs;
    }

    public SettingsDto settings() {
        return new SettingsDto(paymentMode, maxFileBytes / (1024 * 1024), List.of("PDF", "JPEG", "PNG"), ReportService.MAX_EXPORT_ROWS,
                schedulerEnabled, scanIntervalMs / 60_000, "Asia/Kolkata",
                List.of("Payments are SIMULATED: a real payment system needs official access that this project does not have.",
                        "These settings come from the deployment (environment variables); only the SLA limits can be changed in the application.",
                        "Passwords and secrets are never shown here."));
    }
}