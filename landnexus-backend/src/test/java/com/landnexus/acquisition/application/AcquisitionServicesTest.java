package com.landnexus.acquisition.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseParcelResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.ParcelIdentifyRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.SurveyRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.SurveyResponse;
import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.AcquisitionFramework;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.SurveyStatus;
import com.landnexus.acquisition.domain.CaseParcel;
import com.landnexus.acquisition.domain.CaseWorkflow;
import com.landnexus.acquisition.domain.FieldSurvey;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelOwnerRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelRepository;
import com.landnexus.acquisition.infrastructure.CaseStatusHistoryRepository;
import com.landnexus.acquisition.infrastructure.FieldSurveyRepository;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.landrecords.application.LandRecordsLookupService.OwnerShareRef;
import com.landnexus.landrecords.application.LandRecordsLookupService.ParcelRef;
import com.landnexus.projects.application.ProjectLookupService;
import com.landnexus.projects.application.ProjectLookupService.ProjectRef;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AcquisitionServicesTest {

    private static final Instant NOW = Instant.parse("2026-11-06T10:00:00Z");

    @Mock private AcquisitionCaseRepository cases;
    @Mock private CaseParcelRepository caseParcels;
    @Mock private CaseParcelOwnerRepository owners;
    @Mock private FieldSurveyRepository surveys;
    @Mock private CaseStatusHistoryRepository history;
    @Mock private ProjectLookupService projects;
    @Mock private LandRecordsLookupService land;
    @Mock private AdministrationLookupService admin;
    @Mock private GeoScopeService geoScope;
    @Mock private AcquisitionAccess access;
    @Mock private NotificationService notifications;
    @Mock private AuditService audit;
    @Mock private CaseGuards guards;

    private AcquisitionCaseService caseService;
    private SurveyService surveyService;

    private final UUID caseId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final UUID villageId = UUID.randomUUID();
    private final UUID parcelId = UUID.randomUUID();
    private final UUID caseParcelId = UUID.randomUUID();
    private final UUID surveyorId = UUID.randomUUID();

    private final CurrentActor manager = new CurrentActor(UUID.randomUUID(), "manager", Set.of("SCRUTINY_OFFICER"),
            Set.of("ACQUISITION_READ", "ACQUISITION_MANAGE", "SURVEY_VERIFY"));
    private final CurrentActor authority = new CurrentActor(UUID.randomUUID(), "authority", Set.of("COMPETENT_AUTHORITY"),
            Set.of("ACQUISITION_READ", "ACQUISITION_DECIDE"));
    private final CurrentActor surveyor = new CurrentActor(surveyorId, "field", Set.of("FIELD_OFFICER"),
            Set.of("ACQUISITION_READ", "SURVEY_PERFORM"));

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        caseService = new AcquisitionCaseService(cases, caseParcels, owners, surveys, history, projects, land, admin,
                geoScope, access, notifications, audit, clock, guards);
        surveyService = new SurveyService(cases, caseParcels, surveys, land, admin, access, notifications, audit, clock);
        lenient().when(access.canView(any(), any())).thenReturn(true);
        lenient().when(cases.saveAndFlush(any(AcquisitionCase.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(caseParcels.saveAndFlush(any(CaseParcel.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(surveys.saveAndFlush(any(FieldSurvey.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private AcquisitionCase storedCase(CaseStatus status) {
        AcquisitionCase c = new AcquisitionCase();
        ReflectionTestUtils.setField(c, "id", caseId);
        c.setCaseNumber("ACQ-2026-000001");
        c.setProjectId(projectId);
        c.setDistrictId(districtId);
        c.setStatus(status);
        c.getVillageIds().add(villageId);
        lenient().when(cases.findById(caseId)).thenReturn(Optional.of(c));
        lenient().when(cases.findByIdForUpdate(caseId)).thenReturn(Optional.of(c));
        return c;
    }

    private CaseParcel storedCaseParcel(UUID assignedTo) {
        CaseParcel p = new CaseParcel(caseId, parcelId, villageId, new BigDecimal("1.0"));
        ReflectionTestUtils.setField(p, "id", caseParcelId);
        p.setAssignedSurveyorUserId(assignedTo);
        lenient().when(caseParcels.findById(caseParcelId)).thenReturn(Optional.of(p));
        return p;
    }

    private void stubParcel(String areaHa) {
        when(land.findParcel(parcelId)).thenReturn(Optional.of(new ParcelRef(parcelId, villageId, districtId, new BigDecimal(areaHa), true)));
    }

    private SurveyRequest survey(String area, String lat, String lon, String notes) {
        return new SurveyRequest(LocalDate.of(2026, 11, 5), new BigDecimal(area), new BigDecimal(lat), new BigDecimal(lon), notes);
    }

    // ------------------------------------------------------------------ case creation

    @Test
    void create_numbersTheCase_andRecordsHistoryAndAudit() {
        when(projects.findActiveProject(projectId)).thenReturn(Optional.of(
                new ProjectRef(projectId, "PRJ-2026-000001", "DEMO", UUID.randomUUID(), districtId, Set.of(villageId))));
        when(cases.nextNumber()).thenReturn(5L);

        CaseResponse response = caseService.create(new CaseRequest(projectId, AcquisitionFramework.LARR_2013, null, null), manager);

        assertThat(response.caseNumber()).isEqualTo("ACQ-2026-000005");
        assertThat(response.status()).isEqualTo(CaseStatus.INITIATED);
        assertThat(response.availableActions()).containsExactly(CaseWorkflow.START_SURVEY);
        verify(history).save(any());
        verify(audit).record(eq("CREATE"), eq("AcquisitionCase"), any(), anyString());
    }

    @Test
    void create_unknownProject_isRejected() {
        when(projects.findActiveProject(projectId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> caseService.create(new CaseRequest(projectId, AcquisitionFramework.OTHER, null, null), manager))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void create_districtOutsideTheScope_isForbidden() {
        when(projects.findActiveProject(projectId)).thenReturn(Optional.of(
                new ProjectRef(projectId, "P", "T", UUID.randomUUID(), districtId, Set.of())));
        doThrow(new AccessDeniedException("no")).when(geoScope).requireDistrictAccess(manager, districtId);

        assertThatThrownBy(() -> caseService.create(new CaseRequest(projectId, AcquisitionFramework.OTHER, null, null), manager))
                .isInstanceOf(AccessDeniedException.class);
        verify(cases, never()).nextNumber();
    }

    @Test
    void setVillages_outsideTheProject_isRejected() {
        storedCase(CaseStatus.INITIATED);
        when(projects.findActiveProject(projectId)).thenReturn(Optional.of(
                new ProjectRef(projectId, "P", "T", UUID.randomUUID(), districtId, Set.of(villageId))));

        assertThatThrownBy(() -> caseService.setVillages(caseId, Set.of(UUID.randomUUID()), manager))
                .isInstanceOf(InvalidRequestException.class);
    }

    // ------------------------------------------------------------------ affected parcels

    @Test
    void identifyParcel_snapshotsTheCurrentOwners() {
        storedCase(CaseStatus.INITIATED);
        stubParcel("2.0");
        UUID ownerA = UUID.randomUUID();
        when(land.currentOwners(parcelId)).thenReturn(List.of(new OwnerShareRef(ownerA, new BigDecimal("100"))));
        when(owners.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CaseParcelResponse response = caseService.identifyParcel(caseId, new ParcelIdentifyRequest(parcelId, new BigDecimal("1.5")), manager);

        assertThat(response.owners()).hasSize(1);
        assertThat(response.owners().get(0).landownerId()).isEqualTo(ownerA);
        verify(audit).record(eq("IDENTIFY_PARCEL"), eq("AcquisitionCase"), eq(caseId), anyString());
    }

    @Test
    void identifyParcel_inAVillageNotIdentifiedForTheCase_isRejected() {
        storedCase(CaseStatus.INITIATED);
        when(land.findParcel(parcelId)).thenReturn(Optional.of(new ParcelRef(parcelId, UUID.randomUUID(), districtId, new BigDecimal("2"), true)));

        assertThatThrownBy(() -> caseService.identifyParcel(caseId, new ParcelIdentifyRequest(parcelId, BigDecimal.ONE), manager))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void identifyParcel_moreThanTheRecordedArea_isRejected() {
        storedCase(CaseStatus.INITIATED);
        stubParcel("2.0");

        assertThatThrownBy(() -> caseService.identifyParcel(caseId, new ParcelIdentifyRequest(parcelId, new BigDecimal("2.5")), manager))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("recorded area");
    }

    @Test
    void identifyParcel_alreadyInAnotherOpenCase_isAConflict() {
        storedCase(CaseStatus.INITIATED);
        stubParcel("2.0");
        when(caseParcels.existsByParcelIdAndReleasedAtIsNull(parcelId)).thenReturn(true);

        assertThatThrownBy(() -> caseService.identifyParcel(caseId, new ParcelIdentifyRequest(parcelId, BigDecimal.ONE), manager))
                .isInstanceOf(DuplicateResourceException.class);
        verify(caseParcels, never()).saveAndFlush(any());
    }

    @Test
    void assignSurveyor_mustBeAFieldOfficerWithAccess() {
        storedCase(CaseStatus.INITIATED);
        storedCaseParcel(null);
        when(admin.findUsersByRoleWithDistrictAccess("FIELD_OFFICER", districtId)).thenReturn(List.of(new UserRef(UUID.randomUUID(), "other")));

        assertThatThrownBy(() -> caseService.assignSurveyor(caseId, caseParcelId, surveyorId, manager))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void assignSurveyor_notifiesTheSurveyor() {
        storedCase(CaseStatus.INITIATED);
        storedCaseParcel(null);
        when(admin.findUsersByRoleWithDistrictAccess("FIELD_OFFICER", districtId)).thenReturn(List.of(new UserRef(surveyorId, "field")));

        caseService.assignSurveyor(caseId, caseParcelId, surveyorId, manager);

        verify(notifications).notify(eq(surveyorId), anyString(), anyString(), anyString(), anyString(), eq(caseId));
    }

    // ------------------------------------------------------------------ stages

    @Test
    void startSurvey_needsAtLeastOneParcel() {
        storedCase(CaseStatus.INITIATED);
        when(caseParcels.countByCaseIdAndReleasedAtIsNull(caseId)).thenReturn(0L);

        assertThatThrownBy(() -> caseService.transition(caseId, CaseWorkflow.START_SURVEY, null, manager))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void completeVerification_needsEveryParcelVerified() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        when(caseParcels.countByCaseIdAndReleasedAtIsNull(caseId)).thenReturn(2L);
        when(surveys.countParcelsWithStatus(caseId, SurveyStatus.VERIFIED)).thenReturn(1L);

        assertThatThrownBy(() -> caseService.transition(caseId, CaseWorkflow.COMPLETE_VERIFICATION, null, manager))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("1 affected parcel");
    }

    @Test
    void completeVerification_whenAllVerified_moves() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        when(caseParcels.countByCaseIdAndReleasedAtIsNull(caseId)).thenReturn(2L);
        when(surveys.countParcelsWithStatus(caseId, SurveyStatus.VERIFIED)).thenReturn(2L);

        assertThat(caseService.transition(caseId, CaseWorkflow.COMPLETE_VERIFICATION, null, manager).status())
                .isEqualTo(CaseStatus.VERIFICATION_COMPLETE);
    }

    @Test
    void cancel_releasesTheParcels_andNeedsAReason() {
        storedCase(CaseStatus.VERIFICATION_COMPLETE);

        assertThatThrownBy(() -> caseService.transition(caseId, CaseWorkflow.CANCEL, " ", authority))
                .isInstanceOf(InvalidRequestException.class);
        assertThat(caseService.transition(caseId, CaseWorkflow.CANCEL, "Project withdrawn", authority).status())
                .isEqualTo(CaseStatus.CANCELLED);
        verify(caseParcels).releaseAll(eq(caseId), any());
    }

    @Test
    void caseOutsideTheCallersScope_isNotFound() {
        storedCase(CaseStatus.INITIATED);
        when(access.canView(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> caseService.get(caseId, manager)).isInstanceOf(ResourceNotFoundException.class);
    }

    // ------------------------------------------------------------------ surveys

    @Test
    void submitSurvey_storesTheVarianceAgainstTheRecordedArea() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        storedCaseParcel(surveyorId);
        stubParcel("1.0000");
        when(admin.findUsersByRoleWithDistrictAccess("SCRUTINY_OFFICER", districtId)).thenReturn(List.of());

        SurveyResponse r = surveyService.submit(caseId, caseParcelId, survey("1.0500", "19.87", "75.34", null), surveyor);

        assertThat(r.variancePercent()).isEqualByComparingTo("5.00");
        assertThat(r.status()).isEqualTo(SurveyStatus.SUBMITTED);
    }

    @Test
    void submitSurvey_byAnotherFieldOfficer_isForbidden() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        storedCaseParcel(UUID.randomUUID());

        assertThatThrownBy(() -> surveyService.submit(caseId, caseParcelId, survey("1", "19.87", "75.34", null), surveyor))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void submitSurvey_gpsOutsideIndia_isRejected() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        storedCaseParcel(surveyorId);

        assertThatThrownBy(() -> surveyService.submit(caseId, caseParcelId, survey("1", "75.34", "19.87", null), surveyor))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("outside India");
    }

    @Test
    void submitSurvey_bigVarianceNeedsNotes() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        storedCaseParcel(surveyorId);
        stubParcel("1.0000");

        assertThatThrownBy(() -> surveyService.submit(caseId, caseParcelId, survey("1.5000", "19.87", "75.34", " "), surveyor))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Field notes");
    }

    @Test
    void submitSurvey_whileAnotherIsLive_isAConflict() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        storedCaseParcel(surveyorId);
        when(surveys.findFirstByCaseParcelIdAndStatusIn(eq(caseParcelId), any())).thenReturn(Optional.of(
                new FieldSurvey(caseId, caseParcelId, surveyorId, "field", LocalDate.now(), BigDecimal.ONE, BigDecimal.ONE,
                        BigDecimal.ZERO, BigDecimal.ONE, BigDecimal.ONE, null)));

        assertThatThrownBy(() -> surveyService.submit(caseId, caseParcelId, survey("1", "19.87", "75.34", null), surveyor))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void submitSurvey_beforeTheSurveyStage_isAConflict() {
        storedCase(CaseStatus.INITIATED);

        assertThatThrownBy(() -> surveyService.submit(caseId, caseParcelId, survey("1", "19.87", "75.34", null), surveyor))
                .isInstanceOf(InvalidTransitionException.class);
    }

    private FieldSurvey liveSurvey(UUID byUser) {
        FieldSurvey s = new FieldSurvey(caseId, caseParcelId, byUser, "field", LocalDate.of(2026, 11, 5), BigDecimal.ONE,
                BigDecimal.ONE, BigDecimal.ZERO, new BigDecimal("19.87"), new BigDecimal("75.34"), null);
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(s, "id", id);
        when(surveys.findById(id)).thenReturn(Optional.of(s));
        return s;
    }

    @Test
    void verifySurvey_byTheSurveyor_isForbidden() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        FieldSurvey s = liveSurvey(manager.userId());

        assertThatThrownBy(() -> surveyService.verify(caseId, s.getId(), null, manager)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void verifySurvey_byAnotherPerson_marksItVerified_andNotifiesTheSurveyor() {
        storedCase(CaseStatus.SURVEY_IN_PROGRESS);
        FieldSurvey s = liveSurvey(surveyorId);

        SurveyResponse r = surveyService.verify(caseId, s.getId(), "Checked on site", manager);

        assertThat(r.status()).isEqualTo(SurveyStatus.VERIFIED);
        verify(notifications).notify(eq(surveyorId), anyString(), anyString(), anyString(), anyString(), eq(caseId));
    }

    @Test
    void rejectSurvey_needsRemarks() {
        assertThatThrownBy(() -> surveyService.reject(caseId, UUID.randomUUID(), " ", manager)).isInstanceOf(InvalidRequestException.class);
    }
}