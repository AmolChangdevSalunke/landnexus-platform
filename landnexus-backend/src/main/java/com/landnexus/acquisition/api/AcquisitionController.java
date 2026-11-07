package com.landnexus.acquisition.api;

import com.landnexus.acquisition.api.dto.AcquisitionDtos.AssignRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseParcelResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.DecisionRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.HistoryEntry;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.ParcelIdentifyRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.ReasonRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.SurveyRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.SurveyResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.VerificationReport;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.VillagesRequest;
import com.landnexus.acquisition.application.AcquisitionCaseService;
import com.landnexus.acquisition.application.SurveyService;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.CaseWorkflow;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Thin HTTP layer. Rules, scope and ownership checks live in the services. */
@RestController
@RequestMapping("/api/v1/acquisition")
public class AcquisitionController {

    private final AcquisitionCaseService cases;
    private final SurveyService surveys;

    public AcquisitionController(AcquisitionCaseService cases, SurveyService surveys) {
        this.cases = cases;
        this.surveys = surveys;
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/cases")
    @ResponseStatus(HttpStatus.CREATED)
    public CaseResponse create(@Valid @RequestBody CaseRequest request, Authentication a) {
        return cases.create(request, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/cases")
    public PageResponse<CaseResponse> list(@RequestParam(required = false) CaseStatus status,
                                           @RequestParam(required = false) UUID districtId,
                                           @RequestParam(required = false) UUID projectId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size, Authentication a) {
        return cases.list(status, districtId, projectId, page, size, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/cases/{id}")
    public CaseResponse get(@PathVariable UUID id, Authentication a) {
        return cases.get(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/cases/{id}/history")
    public List<HistoryEntry> history(@PathVariable UUID id, Authentication a) {
        return cases.history(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PutMapping("/cases/{id}/villages")
    public CaseResponse setVillages(@PathVariable UUID id, @Valid @RequestBody VillagesRequest request, Authentication a) {
        return cases.setVillages(id, request.villageIds(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/cases/{id}/parcels")
    public List<CaseParcelResponse> parcels(@PathVariable UUID id, Authentication a) {
        return cases.listParcels(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/cases/{id}/parcels")
    @ResponseStatus(HttpStatus.CREATED)
    public CaseParcelResponse identify(@PathVariable UUID id, @Valid @RequestBody ParcelIdentifyRequest request, Authentication a) {
        return cases.identifyParcel(id, request, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @DeleteMapping("/cases/{id}/parcels/{caseParcelId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id, @PathVariable UUID caseParcelId, Authentication a) {
        cases.removeParcel(id, caseParcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/cases/{id}/parcels/{caseParcelId}/assign")
    public CaseParcelResponse assign(@PathVariable UUID id, @PathVariable UUID caseParcelId,
                                     @Valid @RequestBody AssignRequest request, Authentication a) {
        return cases.assignSurveyor(id, caseParcelId, request.surveyorUserId(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SURVEY_PERFORM')")
    @GetMapping("/my-assignments")
    public List<CaseParcelResponse> myAssignments(Authentication a) {
        return cases.myAssignments(CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SURVEY_PERFORM')")
    @PostMapping("/cases/{id}/parcels/{caseParcelId}/surveys")
    @ResponseStatus(HttpStatus.CREATED)
    public SurveyResponse submitSurvey(@PathVariable UUID id, @PathVariable UUID caseParcelId,
                                       @Valid @RequestBody SurveyRequest request, Authentication a) {
        return surveys.submit(id, caseParcelId, request, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/cases/{id}/surveys")
    public List<SurveyResponse> listSurveys(@PathVariable UUID id, Authentication a) {
        return surveys.list(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SURVEY_VERIFY')")
    @PostMapping("/cases/{id}/surveys/{surveyId}/verify")
    public SurveyResponse verifySurvey(@PathVariable UUID id, @PathVariable UUID surveyId,
                                       @Valid @RequestBody(required = false) DecisionRequest request, Authentication a) {
        return surveys.verify(id, surveyId, request == null ? null : request.remarks(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SURVEY_VERIFY')")
    @PostMapping("/cases/{id}/surveys/{surveyId}/reject")
    public SurveyResponse rejectSurvey(@PathVariable UUID id, @PathVariable UUID surveyId,
                                       @Valid @RequestBody DecisionRequest request, Authentication a) {
        return surveys.reject(id, surveyId, request.remarks(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/cases/{id}/verification-report")
    public VerificationReport report(@PathVariable UUID id, Authentication a) {
        return cases.verificationReport(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/cases/{id}/start-survey")
    public CaseResponse startSurvey(@PathVariable UUID id, Authentication a) {
        return cases.transition(id, CaseWorkflow.START_SURVEY, null, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/cases/{id}/complete-verification")
    public CaseResponse completeVerification(@PathVariable UUID id, Authentication a) {
        return cases.transition(id, CaseWorkflow.COMPLETE_VERIFICATION, null, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_DECIDE')")
    @PostMapping("/cases/{id}/cancel")
    public CaseResponse cancel(@PathVariable UUID id, @Valid @RequestBody ReasonRequest request, Authentication a) {
        return cases.transition(id, CaseWorkflow.CANCEL, request.reason(), CurrentActor.from(a));
    }
}