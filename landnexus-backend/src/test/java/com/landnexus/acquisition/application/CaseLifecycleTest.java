package com.landnexus.acquisition.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.acquisition.api.dto.LifecycleDtos.DeclareAwardRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.NoticeRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionDecisionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.PossessionRequest;
import com.landnexus.acquisition.domain.AcquisitionAward;
import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.NoticeType;
import com.landnexus.acquisition.domain.AcquisitionTypes.ObjectionStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.PossessionType;
import com.landnexus.acquisition.domain.CaseParcel;
import com.landnexus.acquisition.domain.CaseWorkflow;
import com.landnexus.acquisition.domain.LegalNotice;
import com.landnexus.acquisition.domain.Objection;
import com.landnexus.acquisition.infrastructure.AcquisitionAwardRepository;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.AwardParcelRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelRepository;
import com.landnexus.acquisition.infrastructure.LegalNoticeRepository;
import com.landnexus.acquisition.infrastructure.ObjectionRepository;
import com.landnexus.acquisition.infrastructure.PossessionRecordRepository;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
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
class CaseLifecycleTest {

    private static final Instant NOW = Instant.parse("2026-11-06T10:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 6);

    @Mock private AcquisitionCaseRepository cases;
    @Mock private CaseParcelRepository caseParcels;
    @Mock private LegalNoticeRepository notices;
    @Mock private ObjectionRepository objections;
    @Mock private AcquisitionAwardRepository awards;
    @Mock private AwardParcelRepository awardParcels;
    @Mock private PossessionRecordRepository possessions;
    @Mock private AcquisitionCaseService caseService;
    @Mock private AdministrationLookupService admin;
    @Mock private AcquisitionAccess access;
    @Mock private NotificationService notifications;
    @Mock private AuditService audit;

    private CaseLifecycleService service;
    private CaseGuards guards;

    private final UUID caseId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final UUID caseParcelId = UUID.randomUUID();
    private final CurrentActor manager = new CurrentActor(UUID.randomUUID(), "manager", Set.of("SCRUTINY_OFFICER"),
            Set.of("ACQUISITION_READ", "ACQUISITION_MANAGE", "LANDOWNER_READ"));
    private final CurrentActor authority = new CurrentActor(UUID.randomUUID(), "authority", Set.of("COMPETENT_AUTHORITY"),
            Set.of("ACQUISITION_READ", "ACQUISITION_DECIDE"));

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new CaseLifecycleService(cases, caseParcels, notices, objections, awards, awardParcels, possessions,
                caseService, admin, access, notifications, audit, clock);
        guards = new CaseGuards(notices, objections, possessions, caseParcels, clock);
        lenient().when(access.canView(any(), any())).thenReturn(true);
        lenient().when(notices.saveAndFlush(any(LegalNotice.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(objections.saveAndFlush(any(Objection.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(possessions.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(awards.saveAndFlush(any(AcquisitionAward.class))).thenAnswer(i -> i.getArgument(0));
    }

    private AcquisitionCase storedCase(CaseStatus status) {
        AcquisitionCase c = new AcquisitionCase();
        ReflectionTestUtils.setField(c, "id", caseId);
        c.setCaseNumber("ACQ-2026-000001");
        c.setDistrictId(districtId);
        c.setStatus(status);
        lenient().when(cases.findById(caseId)).thenReturn(Optional.of(c));
        lenient().when(cases.findByIdForUpdate(caseId)).thenReturn(Optional.of(c));
        return c;
    }

    private void stubPreliminary(LocalDate issuedOn, LocalDate deadline) {
        when(notices.findFirstByCaseIdAndNoticeTypeOrderByIssuedOnDesc(caseId, NoticeType.PRELIMINARY_NOTIFICATION))
                .thenReturn(Optional.of(new LegalNotice(caseId, NoticeType.PRELIMINARY_NOTIFICATION, "GZ-1", issuedOn, deadline, null)));
    }

    // ------------------------------------------------------------------ notices

    @Test
    void preliminaryNotice_needsADeadline_andTheRightStage() {
        storedCase(CaseStatus.VERIFICATION_COMPLETE);

        assertThatThrownBy(() -> service.recordNotice(caseId, new NoticeRequest(NoticeType.PRELIMINARY_NOTIFICATION, "GZ-1", TODAY, null, null), manager))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> service.recordNotice(caseId, new NoticeRequest(NoticeType.AWARD_NOTICE, "GZ-2", TODAY, null, null), manager))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void notice_inTheFuture_orWithADeadlineBeforeIssue_isRejected() {
        storedCase(CaseStatus.VERIFICATION_COMPLETE);

        assertThatThrownBy(() -> service.recordNotice(caseId, new NoticeRequest(NoticeType.PRELIMINARY_NOTIFICATION, "GZ-1", TODAY.plusDays(1), TODAY.plusDays(30), null), manager))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> service.recordNotice(caseId, new NoticeRequest(NoticeType.PRELIMINARY_NOTIFICATION, "GZ-1", TODAY, TODAY.minusDays(1), null), manager))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void notice_isRecorded_andDuplicateReferencesAreRefused() {
        storedCase(CaseStatus.VERIFICATION_COMPLETE);
        NoticeRequest request = new NoticeRequest(NoticeType.PRELIMINARY_NOTIFICATION, "GZ-1", TODAY.minusDays(60), TODAY.minusDays(30), "DEMO");

        assertThat(service.recordNotice(caseId, request, manager).referenceNumber()).isEqualTo("GZ-1");
        verify(audit).record(eq("RECORD_NOTICE"), eq("AcquisitionCase"), eq(caseId), anyString());

        when(notices.existsByCaseIdAndReferenceNumber(caseId, "GZ-1")).thenReturn(true);
        assertThatThrownBy(() -> service.recordNotice(caseId, request, manager)).isInstanceOf(DuplicateResourceException.class);
    }

    // ------------------------------------------------------------------ guards

    @Test
    void guard_issueNotification_needsThePreliminaryNotice() {
        AcquisitionCase c = storedCase(CaseStatus.VERIFICATION_COMPLETE);
        when(notices.findFirstByCaseIdAndNoticeTypeOrderByIssuedOnDesc(caseId, NoticeType.PRELIMINARY_NOTIFICATION)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> guards.check(CaseWorkflow.ISSUE_NOTIFICATION, c)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void guard_closeObjectionWindow_needsAPassedDeadlineAndNoOpenObjections() {
        AcquisitionCase c = storedCase(CaseStatus.NOTIFICATION_ISSUED);
        stubPreliminary(TODAY.minusDays(60), TODAY);
        assertThatThrownBy(() -> guards.check(CaseWorkflow.CLOSE_OBJECTION_WINDOW, c))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("still open");

        stubPreliminary(TODAY.minusDays(60), TODAY.minusDays(1));
        when(objections.countByCaseIdAndStatus(caseId, ObjectionStatus.OPEN)).thenReturn(2L);
        assertThatThrownBy(() -> guards.check(CaseWorkflow.CLOSE_OBJECTION_WINDOW, c))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("2 objection");

        when(objections.countByCaseIdAndStatus(caseId, ObjectionStatus.OPEN)).thenReturn(0L);
        guards.check(CaseWorkflow.CLOSE_OBJECTION_WINDOW, c);
    }

    @Test
    void guard_completePossession_needsEveryParcel() {
        AcquisitionCase c = storedCase(CaseStatus.AWARD_DECLARED);
        when(caseParcels.countByCaseIdAndReleasedAtIsNull(caseId)).thenReturn(2L);
        when(possessions.countByCaseId(caseId)).thenReturn(1L);

        assertThatThrownBy(() -> guards.check(CaseWorkflow.COMPLETE_POSSESSION, c))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("1 affected parcel");
    }

    // ------------------------------------------------------------------ objections

    @Test
    void objection_outsideThePeriod_isRejected() {
        storedCase(CaseStatus.NOTIFICATION_ISSUED);
        stubPreliminary(TODAY.minusDays(60), TODAY.minusDays(30));

        assertThatThrownBy(() -> service.registerObjection(caseId, new ObjectionRequest(caseParcelId, TODAY, "grounds", null), manager))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("outside the objection period");
    }

    @Test
    void objection_inThePeriod_getsANumber_andTheAuditHasNoGrounds() {
        storedCase(CaseStatus.NOTIFICATION_ISSUED);
        stubPreliminary(TODAY.minusDays(60), TODAY.minusDays(30));
        CaseParcel cp = new CaseParcel(caseId, UUID.randomUUID(), UUID.randomUUID(), BigDecimal.ONE);
        when(caseParcels.findById(caseParcelId)).thenReturn(Optional.of(cp));
        when(objections.countByCaseId(caseId)).thenReturn(2L);
        when(admin.findUsersByRoleWithDistrictAccess("COMPETENT_AUTHORITY", districtId)).thenReturn(List.of());

        ObjectionResponse r = service.registerObjection(caseId,
                new ObjectionRequest(caseParcelId, TODAY.minusDays(45), "SECRET GROUNDS TEXT", "DEMO objector"), manager);

        assertThat(r.objectionNumber()).isEqualTo("OBJ-003");
        verify(audit).record(eq("REGISTER_OBJECTION"), eq("AcquisitionCase"), eq(caseId), org.mockito.ArgumentMatchers.argThat(s -> !s.contains("SECRET")));
    }

    private Objection storedObjection(UUID registeredBy) {
        Objection o = new Objection(caseId, caseParcelId, "OBJ-001", TODAY.minusDays(45), "grounds", "ref", registeredBy);
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(o, "id", id);
        when(objections.findById(id)).thenReturn(Optional.of(o));
        return o;
    }

    @Test
    void objection_cannotBeDecidedByItsRegistrar() {
        storedCase(CaseStatus.NOTIFICATION_ISSUED);
        Objection o = storedObjection(authority.userId());

        assertThatThrownBy(() -> service.decideObjection(caseId, o.getId(), new ObjectionDecisionRequest(ObjectionStatus.DISMISSED, "no"), authority))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void objection_decision_isFinal_andNotifiesTheRegistrar() {
        storedCase(CaseStatus.NOTIFICATION_ISSUED);
        Objection o = storedObjection(manager.userId());

        ObjectionResponse r = service.decideObjection(caseId, o.getId(), new ObjectionDecisionRequest(ObjectionStatus.ACCEPTED, "valid"), authority);

        assertThat(r.status()).isEqualTo(ObjectionStatus.ACCEPTED);
        verify(notifications).notify(eq(manager.userId()), anyString(), anyString(), anyString(), anyString(), eq(caseId));
        assertThatThrownBy(() -> service.decideObjection(caseId, o.getId(), new ObjectionDecisionRequest(ObjectionStatus.DISMISSED, "again"), authority))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void objectorReference_isMaskedWithoutLandownerRead() {
        storedCase(CaseStatus.NOTIFICATION_ISSUED);
        Objection o = new Objection(caseId, caseParcelId, "OBJ-001", TODAY, "grounds", "DEMO objector", manager.userId());
        when(objections.findByCaseIdOrderByObjectionNumberAsc(caseId)).thenReturn(List.of(o));

        assertThat(service.listObjections(caseId, authority).get(0).objectorReference()).isNull();
        verify(audit, never()).record(eq("VIEW_OBJECTIONS"), any(), any(), any());
        assertThat(service.listObjections(caseId, manager).get(0).objectorReference()).isEqualTo("DEMO objector");
        verify(audit).record(eq("VIEW_OBJECTIONS"), any(), any(), any());
    }

    // ------------------------------------------------------------------ award and possession

    @Test
    void award_beforeTheObjectionDeadline_isRejected() {
        storedCase(CaseStatus.READY_FOR_AWARD);
        stubPreliminary(TODAY.minusDays(60), TODAY.minusDays(30));

        assertThatThrownBy(() -> service.declareAward(caseId, new DeclareAwardRequest("AW-1", TODAY.minusDays(40), null), authority))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void award_isDeclared_withOneLinePerParcel() {
        storedCase(CaseStatus.READY_FOR_AWARD);
        stubPreliminary(TODAY.minusDays(60), TODAY.minusDays(30));
        when(caseParcels.findByCaseIdAndReleasedAtIsNullOrderByIdentifiedAtAsc(caseId)).thenReturn(List.of(
                new CaseParcel(caseId, UUID.randomUUID(), UUID.randomUUID(), BigDecimal.ONE),
                new CaseParcel(caseId, UUID.randomUUID(), UUID.randomUUID(), BigDecimal.TEN)));

        service.declareAward(caseId, new DeclareAwardRequest("AW-1", TODAY.minusDays(10), "DEMO"), authority);

        verify(caseService).transition(caseId, CaseWorkflow.DECLARE_AWARD, null, authority);
        verify(awardParcels, org.mockito.Mockito.times(2)).save(any());
        verify(audit).record(eq("DECLARE_AWARD"), eq("AcquisitionCase"), eq(caseId), anyString());
    }

    @Test
    void possession_beforeTheAwardDate_orTwice_isRefused() {
        storedCase(CaseStatus.AWARD_DECLARED);
        CaseParcel cp = new CaseParcel(caseId, UUID.randomUUID(), UUID.randomUUID(), BigDecimal.ONE);
        when(caseParcels.findById(caseParcelId)).thenReturn(Optional.of(cp));
        when(awards.findByCaseId(caseId)).thenReturn(Optional.of(new AcquisitionAward(caseId, "AW-1", TODAY.minusDays(10), null, UUID.randomUUID())));

        assertThatThrownBy(() -> service.recordPossession(caseId, new PossessionRequest(caseParcelId, TODAY.minusDays(20), PossessionType.PHYSICAL, null), manager))
                .isInstanceOf(InvalidRequestException.class);
        service.recordPossession(caseId, new PossessionRequest(caseParcelId, TODAY.minusDays(5), PossessionType.PHYSICAL, null), manager);

        when(possessions.existsByCaseParcelId(caseParcelId)).thenReturn(true);
        assertThatThrownBy(() -> service.recordPossession(caseId, new PossessionRequest(caseParcelId, TODAY.minusDays(4), PossessionType.DEEMED, null), manager))
                .isInstanceOf(DuplicateResourceException.class);
    }
}