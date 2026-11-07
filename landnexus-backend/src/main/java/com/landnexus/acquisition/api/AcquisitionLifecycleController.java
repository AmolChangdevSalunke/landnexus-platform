package com.landnexus.acquisition.api;

import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.ReasonRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.AwardResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.DeclareAwardRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.NoticeRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.NoticeResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionDecisionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.PhotoResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.PossessionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.PossessionResponse;
import com.landnexus.acquisition.application.AcquisitionCaseService;
import com.landnexus.acquisition.application.CaseLifecycleService;
import com.landnexus.acquisition.application.SurveyPhotoService;
import com.landnexus.acquisition.domain.CaseWorkflow;
import com.landnexus.landrecords.application.UploadedFile;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Notices, objections, award, possession, closure and survey photos. Rules live in the services. */
@RestController
@RequestMapping("/api/v1/acquisition/cases/{caseId}")
public class AcquisitionLifecycleController {

    private final CaseLifecycleService lifecycle;
    private final AcquisitionCaseService cases;
    private final SurveyPhotoService photos;

    public AcquisitionLifecycleController(CaseLifecycleService lifecycle, AcquisitionCaseService cases, SurveyPhotoService photos) {
        this.lifecycle = lifecycle;
        this.cases = cases;
        this.photos = photos;
    }

    // ---- notices
    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/notices")
    public List<NoticeResponse> notices(@PathVariable UUID caseId, Authentication a) {
        return lifecycle.listNotices(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/notices")
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse recordNotice(@PathVariable UUID caseId, @Valid @RequestBody NoticeRequest r, Authentication a) {
        return lifecycle.recordNotice(caseId, r, CurrentActor.from(a));
    }

    // ---- objections
    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/objections")
    public List<ObjectionResponse> objections(@PathVariable UUID caseId, Authentication a) {
        return lifecycle.listObjections(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/objections")
    @ResponseStatus(HttpStatus.CREATED)
    public ObjectionResponse registerObjection(@PathVariable UUID caseId, @Valid @RequestBody ObjectionRequest r, Authentication a) {
        return lifecycle.registerObjection(caseId, r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_DECIDE')")
    @PostMapping("/objections/{objectionId}/decide")
    public ObjectionResponse decideObjection(@PathVariable UUID caseId, @PathVariable UUID objectionId,
                                             @Valid @RequestBody ObjectionDecisionRequest r, Authentication a) {
        return lifecycle.decideObjection(caseId, objectionId, r, CurrentActor.from(a));
    }

    // ---- stage changes
    @PreAuthorize("hasAuthority('ACQUISITION_DECIDE')")
    @PostMapping("/issue-notification")
    public CaseResponse issueNotification(@PathVariable UUID caseId, Authentication a) {
        return cases.transition(caseId, CaseWorkflow.ISSUE_NOTIFICATION, null, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/close-objection-window")
    public CaseResponse closeObjectionWindow(@PathVariable UUID caseId, Authentication a) {
        return cases.transition(caseId, CaseWorkflow.CLOSE_OBJECTION_WINDOW, null, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/complete-possession")
    public CaseResponse completePossession(@PathVariable UUID caseId, Authentication a) {
        return cases.transition(caseId, CaseWorkflow.COMPLETE_POSSESSION, null, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_DECIDE')")
    @PostMapping("/close")
    public CaseResponse close(@PathVariable UUID caseId, @Valid @RequestBody(required = false) ReasonRequest r, Authentication a) {
        return cases.transition(caseId, CaseWorkflow.CLOSE, r == null ? null : r.reason(), CurrentActor.from(a));
    }

    // ---- award and possession
    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/award")
    public AwardResponse award(@PathVariable UUID caseId, Authentication a) {
        return lifecycle.getAward(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_DECIDE')")
    @PostMapping("/award")
    @ResponseStatus(HttpStatus.CREATED)
    public AwardResponse declareAward(@PathVariable UUID caseId, @Valid @RequestBody DeclareAwardRequest r, Authentication a) {
        return lifecycle.declareAward(caseId, r, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/possessions")
    public List<PossessionResponse> possessions(@PathVariable UUID caseId, Authentication a) {
        return lifecycle.listPossessions(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_MANAGE')")
    @PostMapping("/possessions")
    @ResponseStatus(HttpStatus.CREATED)
    public PossessionResponse recordPossession(@PathVariable UUID caseId, @Valid @RequestBody PossessionRequest r, Authentication a) {
        return lifecycle.recordPossession(caseId, r, CurrentActor.from(a));
    }

    // ---- geo-tagged survey photos (multipart)
    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/surveys/{surveyId}/photos")
    public List<PhotoResponse> listPhotos(@PathVariable UUID caseId, @PathVariable UUID surveyId, Authentication a) {
        return photos.list(caseId, surveyId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('SURVEY_PERFORM')")
    @PostMapping(path = "/surveys/{surveyId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoResponse uploadPhoto(@PathVariable UUID caseId, @PathVariable UUID surveyId,
                                     @RequestPart("file") MultipartFile file, @RequestParam BigDecimal latitude,
                                     @RequestParam BigDecimal longitude, @RequestParam(required = false) Instant capturedAt,
                                     Authentication a) {
        return photos.upload(caseId, surveyId, UploadedFile.of(file), latitude, longitude, capturedAt, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('ACQUISITION_READ')")
    @GetMapping("/surveys/{surveyId}/photos/{photoId}/download")
    public ResponseEntity<Resource> downloadPhoto(@PathVariable UUID caseId, @PathVariable UUID surveyId,
                                                  @PathVariable UUID photoId, Authentication a) {
        UploadedFile.Download f = photos.download(caseId, surveyId, photoId, CurrentActor.from(a));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(f.contentType())).contentLength(f.size())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(f.filename(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff").header(HttpHeaders.CACHE_CONTROL, "no-store").body(f.resource());
    }
}