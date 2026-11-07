package com.landnexus.compensation.api;

import com.landnexus.compensation.api.dto.CompensationDtos.AssetRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.AssetResponse;
import com.landnexus.compensation.api.dto.CompensationDtos.CompensationSummary;
import com.landnexus.compensation.api.dto.CompensationDtos.RateRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.RateResponse;
import com.landnexus.compensation.api.dto.CompensationDtos.Remarks;
import com.landnexus.compensation.api.dto.CompensationDtos.RuleSetRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.RuleSetResponse;
import com.landnexus.compensation.api.dto.CompensationDtos.ValuationResponse;
import com.landnexus.compensation.api.dto.CompensationDtos.VoidRequest;
import com.landnexus.compensation.application.RateService;
import com.landnexus.compensation.application.RuleSetService;
import com.landnexus.compensation.application.ValuationService;
import com.landnexus.compensation.domain.CompTypes.RateStatus;
import com.landnexus.compensation.domain.CompTypes.RuleSetStatus;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Thin HTTP layer: market value rates, rule sets, assets, estimates. Rules and scope live in the services. */
@RestController
@RequestMapping("/api/v1/compensation")
public class CompensationController {

    private final RateService rates;
    private final RuleSetService ruleSets;
    private final ValuationService valuations;

    public CompensationController(RateService rates, RuleSetService ruleSets, ValuationService valuations) {
        this.rates = rates;
        this.ruleSets = ruleSets;
        this.valuations = valuations;
    }

    // ---- rates
    @PreAuthorize("hasAuthority('VALUATION_READ')")
    @GetMapping("/rates")
    public PageResponse<RateResponse> listRates(@RequestParam(required = false) UUID villageId,
                                                @RequestParam(required = false) RateStatus status,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size, Authentication a) {
        return rates.list(villageId, status, page, size, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RATE_MANAGE')")
    @PostMapping("/rates")
    @ResponseStatus(HttpStatus.CREATED)
    public RateResponse createRate(@Valid @RequestBody RateRequest r, Authentication a) {
        return rates.create(r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RATE_APPROVE')")
    @PostMapping("/rates/{id}/approve")
    public RateResponse approveRate(@PathVariable UUID id, @Valid @RequestBody(required = false) Remarks r, Authentication a) {
        return rates.approve(id, r == null ? null : r.remarks(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RATE_APPROVE')")
    @PostMapping("/rates/{id}/reject")
    public RateResponse rejectRate(@PathVariable UUID id, @Valid @RequestBody Remarks r, Authentication a) {
        return rates.reject(id, r.remarks(), CurrentActor.from(a));
    }

    // ---- rule sets
    @PreAuthorize("hasAuthority('VALUATION_READ')")
    @GetMapping("/rule-sets")
    public PageResponse<RuleSetResponse> listRuleSets(@RequestParam(required = false) RuleSetStatus status,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
        return ruleSets.list(status, page, size);
    }

    @PreAuthorize("hasAuthority('VALUATION_READ')")
    @GetMapping("/rule-sets/{id}")
    public RuleSetResponse getRuleSet(@PathVariable UUID id) {
        return ruleSets.get(id);
    }

    @PreAuthorize("hasAuthority('RULESET_MANAGE')")
    @PostMapping("/rule-sets")
    @ResponseStatus(HttpStatus.CREATED)
    public RuleSetResponse createRuleSet(@Valid @RequestBody RuleSetRequest r, Authentication a) {
        return ruleSets.create(r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RULESET_APPROVE')")
    @PostMapping("/rule-sets/{id}/approve")
    public RuleSetResponse approveRuleSet(@PathVariable UUID id, Authentication a) {
        return ruleSets.approve(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('RULESET_MANAGE')")
    @PostMapping("/rule-sets/{id}/retire")
    public RuleSetResponse retireRuleSet(@PathVariable UUID id, @Valid @RequestBody Remarks r, Authentication a) {
        return ruleSets.retire(id, r.remarks(), CurrentActor.from(a));
    }

    // ---- assets
    @PreAuthorize("hasAuthority('VALUATION_READ')")
    @GetMapping("/cases/{caseId}/parcels/{caseParcelId}/assets")
    public List<AssetResponse> assets(@PathVariable UUID caseId, @PathVariable UUID caseParcelId, Authentication a) {
        return valuations.listAssets(caseId, caseParcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_MANAGE')")
    @PostMapping("/cases/{caseId}/parcels/{caseParcelId}/assets")
    @ResponseStatus(HttpStatus.CREATED)
    public AssetResponse addAsset(@PathVariable UUID caseId, @PathVariable UUID caseParcelId,
                                  @Valid @RequestBody AssetRequest r, Authentication a) {
        return valuations.recordAsset(caseId, caseParcelId, r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_MANAGE')")
    @PostMapping("/cases/{caseId}/assets/{assetId}/void")
    public AssetResponse voidAsset(@PathVariable UUID caseId, @PathVariable UUID assetId,
                                   @Valid @RequestBody VoidRequest r, Authentication a) {
        return valuations.voidAsset(caseId, assetId, r.reason(), CurrentActor.from(a));
    }

    // ---- estimates
    @PreAuthorize("hasAuthority('VALUATION_READ')")
    @GetMapping("/cases/{caseId}/valuations")
    public List<ValuationResponse> listValuations(@PathVariable UUID caseId, Authentication a) {
        return valuations.listForCase(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_MANAGE')")
    @PostMapping("/cases/{caseId}/parcels/{caseParcelId}/valuations")
    @ResponseStatus(HttpStatus.CREATED)
    public ValuationResponse compute(@PathVariable UUID caseId, @PathVariable UUID caseParcelId, Authentication a) {
        return valuations.compute(caseId, caseParcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_READ')")
    @GetMapping("/valuations/{id}")
    public ValuationResponse getValuation(@PathVariable UUID id, Authentication a) {
        return valuations.get(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_MANAGE')")
    @PostMapping("/valuations/{id}/submit")
    public ValuationResponse submit(@PathVariable UUID id, Authentication a) {
        return valuations.submit(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_APPROVE')")
    @PostMapping("/valuations/{id}/approve")
    public ValuationResponse approve(@PathVariable UUID id, @Valid @RequestBody(required = false) Remarks r, Authentication a) {
        return valuations.approve(id, r == null ? null : r.remarks(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_APPROVE')")
    @PostMapping("/valuations/{id}/reject")
    public ValuationResponse reject(@PathVariable UUID id, @Valid @RequestBody Remarks r, Authentication a) {
        return valuations.reject(id, r.remarks(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('VALUATION_READ')")
    @GetMapping("/cases/{caseId}/compensation-summary")
    public CompensationSummary summary(@PathVariable UUID caseId, Authentication a) {
        return valuations.summary(caseId, CurrentActor.from(a));
    }
}