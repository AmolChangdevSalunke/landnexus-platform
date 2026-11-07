package com.landnexus.acquisition.application;

import com.landnexus.acquisition.api.dto.AcquisitionDtos.SurveyRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.SurveyResponse;
import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.SurveyStatus;
import com.landnexus.acquisition.domain.CaseParcel;
import com.landnexus.acquisition.domain.FieldSurvey;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelRepository;
import com.landnexus.acquisition.infrastructure.FieldSurveyRepository;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.landrecords.application.LandRecordsLookupService.ParcelRef;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Field surveys: measurement, GPS point and notes by the assigned surveyor; manual verification by someone else. */
@Service
@Transactional(readOnly = true)
public class SurveyService {

    static final BigDecimal VARIANCE_NOTE_THRESHOLD = new BigDecimal("10");
    // Rough bounding box of India: catches swapped or mistyped coordinates, it is not a border test.
    static final BigDecimal MIN_LAT = new BigDecimal("6.0");
    static final BigDecimal MAX_LAT = new BigDecimal("37.6");
    static final BigDecimal MIN_LON = new BigDecimal("68.0");
    static final BigDecimal MAX_LON = new BigDecimal("97.5");

    private final AcquisitionCaseRepository cases;
    private final CaseParcelRepository caseParcels;
    private final FieldSurveyRepository surveys;
    private final LandRecordsLookupService land;
    private final AdministrationLookupService admin;
    private final AcquisitionAccess access;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public SurveyService(AcquisitionCaseRepository cases, CaseParcelRepository caseParcels, FieldSurveyRepository surveys,
                         LandRecordsLookupService land, AdministrationLookupService admin, AcquisitionAccess access,
                         NotificationService notifications, AuditService audit, Clock clock) {
        this.cases = cases;
        this.caseParcels = caseParcels;
        this.surveys = surveys;
        this.land = land;
        this.admin = admin;
        this.access = access;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    public List<SurveyResponse> list(UUID caseId, CurrentActor actor) {
        loadVisible(caseId, actor);
        return surveys.findByCaseIdOrderByCreatedAtAsc(caseId).stream().map(SurveyResponse::from).toList();
    }

    @Transactional
    public SurveyResponse submit(UUID caseId, UUID caseParcelId, SurveyRequest request, CurrentActor actor) {
        AcquisitionCase c = loadVisible(caseId, actor);
        if (c.getStatus() != CaseStatus.SURVEY_IN_PROGRESS) {
            throw new InvalidTransitionException("Surveys can be recorded only while the case is SURVEY_IN_PROGRESS");
        }
        CaseParcel cp = caseParcels.findById(caseParcelId)
                .filter(p -> p.getCaseId().equals(caseId) && p.getReleasedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Affected parcel not found: " + caseParcelId));
        if (!actor.userId().equals(cp.getAssignedSurveyorUserId())) {
            throw new AccessDeniedException("This parcel is not assigned to you");
        }
        if (surveys.findFirstByCaseParcelIdAndStatusIn(cp.getId(), List.of(SurveyStatus.SUBMITTED, SurveyStatus.VERIFIED)).isPresent()) {
            throw new DuplicateResourceException("This parcel already has a survey that is awaiting verification or verified");
        }
        requireInsideIndia(request);
        ParcelRef parcel = land.findParcel(cp.getParcelId())
                .orElseThrow(() -> new ResourceNotFoundException("The parcel record was not found"));
        BigDecimal variance = request.measuredAreaHa().subtract(parcel.areaHa())
                .multiply(new BigDecimal("100")).divide(parcel.areaHa(), 2, RoundingMode.HALF_UP);
        String notes = blankToNull(request.fieldNotes());
        if (variance.abs().compareTo(VARIANCE_NOTE_THRESHOLD) > 0 && notes == null) {
            throw new InvalidRequestException("Field notes are required when the measured area differs from the recorded area by more than "
                    + VARIANCE_NOTE_THRESHOLD + "% (it differs by " + variance + "%)");
        }
        FieldSurvey saved = surveys.saveAndFlush(new FieldSurvey(caseId, cp.getId(), actor.userId(), actor.username(),
                request.surveyedOn(), request.measuredAreaHa(), parcel.areaHa(), variance, request.gpsLatitude(),
                request.gpsLongitude(), notes));
        for (UserRef officer : admin.findUsersByRoleWithDistrictAccess("SCRUTINY_OFFICER", c.getDistrictId())) {
            notifications.notify(officer.id(), "ACQUISITION", "Survey awaiting verification",
                    "A field survey of case " + c.getCaseNumber() + " was submitted.", "AcquisitionCase", caseId);
        }
        audit.record("SUBMIT_SURVEY", "AcquisitionCase", caseId, "caseParcelId=" + caseParcelId + ", measuredAreaHa="
                + request.measuredAreaHa() + ", variancePercent=" + variance);
        return SurveyResponse.from(saved);
    }

    @Transactional
    public SurveyResponse verify(UUID caseId, UUID surveyId, String remarks, CurrentActor actor) {
        return decide(caseId, surveyId, SurveyStatus.VERIFIED, blankToNull(remarks), actor);
    }

    @Transactional
    public SurveyResponse reject(UUID caseId, UUID surveyId, String remarks, CurrentActor actor) {
        String reason = blankToNull(remarks);
        if (reason == null) {
            throw new InvalidRequestException("Remarks are required when rejecting a survey");
        }
        return decide(caseId, surveyId, SurveyStatus.REJECTED, reason, actor);
    }

    private SurveyResponse decide(UUID caseId, UUID surveyId, SurveyStatus outcome, String remarks, CurrentActor actor) {
        AcquisitionCase c = loadVisible(caseId, actor);
        if (c.getStatus() != CaseStatus.SURVEY_IN_PROGRESS) {
            throw new InvalidTransitionException("Surveys can be verified only while the case is SURVEY_IN_PROGRESS");
        }
        FieldSurvey s = surveys.findById(surveyId).filter(x -> x.getCaseId().equals(caseId))
                .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + surveyId));
        if (s.getStatus() != SurveyStatus.SUBMITTED) {
            throw new InvalidTransitionException("Only a survey that is awaiting verification can be verified or rejected");
        }
        if (actor.userId().equals(s.getSurveyorUserId())) {
            throw new AccessDeniedException("The surveyor cannot verify or reject their own survey");
        }
        s.decide(outcome, actor.userId(), clock.instant(), remarks);
        FieldSurvey saved = surveys.saveAndFlush(s);
        notifications.notify(s.getSurveyorUserId(), "ACQUISITION",
                outcome == SurveyStatus.VERIFIED ? "Survey verified" : "Survey rejected",
                "Your survey of case " + c.getCaseNumber() + " was " + outcome.name().toLowerCase() + ".",
                "AcquisitionCase", caseId);
        audit.record(outcome == SurveyStatus.VERIFIED ? "VERIFY_SURVEY" : "REJECT_SURVEY", "AcquisitionCase", caseId,
                "surveyId=" + surveyId + (remarks == null ? "" : ", remarks=" + remarks));
        return SurveyResponse.from(saved);
    }

    private static void requireInsideIndia(SurveyRequest r) {
        if (r.gpsLatitude().compareTo(MIN_LAT) < 0 || r.gpsLatitude().compareTo(MAX_LAT) > 0
                || r.gpsLongitude().compareTo(MIN_LON) < 0 || r.gpsLongitude().compareTo(MAX_LON) > 0) {
            throw new InvalidRequestException("The GPS point is outside India: check that latitude and longitude are not swapped");
        }
    }

    private AcquisitionCase loadVisible(UUID caseId, CurrentActor actor) {
        return cases.findById(caseId).filter(c -> access.canView(actor, c.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Case not found: " + caseId));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}