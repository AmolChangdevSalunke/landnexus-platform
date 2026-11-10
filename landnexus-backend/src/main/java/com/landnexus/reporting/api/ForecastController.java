package com.landnexus.reporting.api;

import com.landnexus.reporting.api.dto.ForecastDtos.ForecastOverview;
import com.landnexus.reporting.application.ForecastService;
import com.landnexus.shared.security.CurrentActor;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/monitoring")
public class ForecastController {

    private final ForecastService service;

    public ForecastController(ForecastService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('SLA_READ')")
    @GetMapping("/forecast")
    public ForecastOverview forecast(@RequestParam(required = false) UUID stateId, @RequestParam(required = false) UUID districtId,
                                     Authentication a) {
        return service.overview(stateId, districtId, CurrentActor.from(a));
    }
}