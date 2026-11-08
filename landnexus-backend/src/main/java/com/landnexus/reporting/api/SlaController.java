package com.landnexus.reporting.api;

import com.landnexus.reporting.api.dto.SlaDtos.EscalationPage;
import com.landnexus.reporting.api.dto.SlaDtos.ScanResult;
import com.landnexus.reporting.api.dto.SlaDtos.SettingsDto;
import com.landnexus.reporting.api.dto.SlaDtos.SlaOverview;
import com.landnexus.reporting.api.dto.SlaDtos.SlaRuleDto;
import com.landnexus.reporting.api.dto.SlaDtos.SlaRuleRequest;
import com.landnexus.reporting.application.SettingsService;
import com.landnexus.reporting.application.SlaService;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/monitoring")
public class SlaController {

    private final SlaService sla;
    private final SettingsService settings;

    public SlaController(SlaService sla, SettingsService settings) {
        this.sla = sla;
        this.settings = settings;
    }

    @PreAuthorize("hasAuthority('SLA_READ')")
    @GetMapping("/sla")
    public SlaOverview overview(@RequestParam(required = false) UUID stateId, @RequestParam(required = false) UUID districtId,
                                Authentication a) {
        return sla.overview(stateId, districtId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SLA_READ')")
    @GetMapping("/sla/rules")
    public List<SlaRuleDto> rules() {
        return sla.rules();
    }

    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @PutMapping("/sla/rules/{itemType}")
    public SlaRuleDto updateRule(@PathVariable String itemType, @Valid @RequestBody SlaRuleRequest r, Authentication a) {
        return sla.updateRule(itemType, r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @PostMapping("/sla/scan")
    public ScanResult scan(@RequestParam(required = false) UUID districtId, Authentication a) {
        return sla.scanBy(districtId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SLA_READ')")
    @GetMapping("/sla/escalations")
    public EscalationPage escalations(@RequestParam(required = false) UUID stateId, @RequestParam(required = false) UUID districtId,
                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                      Authentication a) {
        return sla.escalations(stateId, districtId, page, size, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @GetMapping("/settings")
    public SettingsDto settings() {
        return settings.settings();
    }
}