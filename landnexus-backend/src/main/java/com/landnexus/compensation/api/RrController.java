package com.landnexus.compensation.api;

import com.landnexus.compensation.api.dto.PaymentRrDtos.BenefitTypeRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.BenefitTypeResponse;
import com.landnexus.compensation.api.dto.PaymentRrDtos.DeliverRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.EntitlementRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.RrCaseRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.RrCaseResponse;
import com.landnexus.compensation.application.RrService;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/compensation")
public class RrController {

    private final RrService rr;

    public RrController(RrService rr) {
        this.rr = rr;
    }

    @PreAuthorize("hasAuthority('RR_READ')")
    @GetMapping("/rr/benefit-types")
    public List<BenefitTypeResponse> benefitTypes() {
        return rr.listBenefitTypes();
    }

    @PreAuthorize("hasAuthority('RR_CATALOGUE')")
    @PostMapping("/rr/benefit-types")
    @ResponseStatus(HttpStatus.CREATED)
    public BenefitTypeResponse createBenefitType(@Valid @RequestBody BenefitTypeRequest r, Authentication a) {
        return rr.createBenefitType(r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RR_READ')")
    @GetMapping("/cases/{caseId}/rr-cases")
    public List<RrCaseResponse> list(@PathVariable UUID caseId, Authentication a) {
        return rr.listForCase(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RR_MANAGE')")
    @PostMapping("/cases/{caseId}/rr-cases")
    @ResponseStatus(HttpStatus.CREATED)
    public RrCaseResponse identify(@PathVariable UUID caseId, @Valid @RequestBody RrCaseRequest r, Authentication a) {
        return rr.identify(caseId, r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RR_READ')")
    @GetMapping("/rr-cases/{id}")
    public RrCaseResponse get(@PathVariable UUID id, Authentication a) {
        return rr.get(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RR_MANAGE')")
    @PostMapping("/rr-cases/{id}/entitlements")
    @ResponseStatus(HttpStatus.CREATED)
    public RrCaseResponse addEntitlement(@PathVariable UUID id, @Valid @RequestBody EntitlementRequest r, Authentication a) {
        return rr.addEntitlement(id, r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RR_APPROVE')")
    @PostMapping("/rr-cases/{id}/approve")
    public RrCaseResponse approve(@PathVariable UUID id, Authentication a) {
        return rr.approve(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RR_MANAGE')")
    @PostMapping("/rr-cases/{id}/entitlements/{entitlementId}/deliver")
    public RrCaseResponse deliver(@PathVariable UUID id, @PathVariable UUID entitlementId,
                                  @Valid @RequestBody DeliverRequest r, Authentication a) {
        return rr.deliver(id, entitlementId, r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RR_MANAGE')")
    @PostMapping("/rr-cases/{id}/complete")
    public RrCaseResponse complete(@PathVariable UUID id, Authentication a) {
        return rr.complete(id, CurrentActor.from(a));
    }
}