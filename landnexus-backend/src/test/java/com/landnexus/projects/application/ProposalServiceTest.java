package com.landnexus.projects.application;

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

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.DistrictRef;
import com.landnexus.administration.application.AdministrationLookupService.TalukaRef;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.administration.application.AdministrationLookupService.VillageRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.projects.api.dto.ProposalRequest;
import com.landnexus.projects.api.dto.ProposalResponse;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProposalStatusHistory;
import com.landnexus.projects.domain.ProposalVersion;
import com.landnexus.projects.domain.ProposalWorkflow;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.projects.infrastructure.ProposalAssignmentRepository;
import com.landnexus.projects.infrastructure.ProposalRepository;
import com.landnexus.projects.infrastructure.ProposalStatusHistoryRepository;
import com.landnexus.projects.infrastructure.ProposalVersionRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.pagination.PageResponse;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProposalServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-03T10:00:00Z");

    @Mock private ProposalRepository proposals;
    @Mock private ProposalVersionRepository versions;
    @Mock private ProposalStatusHistoryRepository history;
    @Mock private ProjectRepository projects;
    @Mock private ProposalAssignmentRepository assignmentRepository;
    @Mock private AdministrationLookupService lookup;
    @Mock private GeoScopeService geoScope;
    @Mock private ProposalAccess access;
    @Mock private NotificationService notifications;
    @Mock private AuditService audit;
    @Mock private AcquisitionCaseInitiator acquisitionCaseInitiator;
    @Mock private ProposalValidationService validationService;
    @Mock private ProposalRoutingService routing;

    private ProposalService service;

    private final UUID ownerId = UUID.randomUUID();
    private final UUID officerId = UUID.randomUUID();
    private final UUID authorityId = UUID.randomUUID();
    private final UUID stateId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final UUID talukaId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final UUID villageId = UUID.randomUUID();
    private final UUID proposalId = UUID.randomUUID();

    private final CurrentActor consultant = new CurrentActor(ownerId, "consultant", Set.of("CONSULTANT"),
            Set.of("PROPOSAL_CREATE", "PROPOSAL_READ_OWN"));
    private final CurrentActor otherConsultant = new CurrentActor(UUID.randomUUID(), "other", Set.of("CONSULTANT"),
            Set.of("PROPOSAL_CREATE", "PROPOSAL_READ_OWN"));
    private final CurrentActor officer = new CurrentActor(officerId, "officer", Set.of("SCRUTINY_OFFICER"),
            Set.of("PROPOSAL_READ", "PROPOSAL_SCRUTINIZE"));
    private final CurrentActor authority = new CurrentActor(authorityId, "authority", Set.of("COMPETENT_AUTHORITY"),
            Set.of("PROPOSAL_READ", "PROPOSAL_DECIDE"));

    @BeforeEach
    void setUp() {
        service = new ProposalService(proposals, versions, history, projects, assignmentRepository, lookup, geoScope,
                access, notifications, audit, Clock.fixed(NOW, ZoneOffset.UTC), acquisitionCaseInitiator,
                validationService, routing);
        lenient().when(proposals.saveAndFlush(any(Proposal.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(access.canView(any(), any(), any())).thenReturn(true);
        lenient().when(validationService.validate(any())).thenReturn(new ProposalValidationService.ValidationResult(true, List.of()));
        lenient().when(acquisitionCaseInitiator.initiateForApprovedProject(any(), any(), any()))
                .thenReturn(Optional.of(new AcquisitionCaseInitiator.InitiatedCase(UUID.randomUUID(), "ACQ-2026-000001")));
        lenient().when(acquisitionCaseInitiator.findCaseNumberByProjectId(any())).thenReturn(Optional.empty());
        lenient().when(proposals.findCurrentById(any())).thenAnswer(inv -> proposals.findById(inv.getArgument(0)));
    }

    // ------------------------------------------------------------------ helpers

    private ProposalRequest request() {
        return new ProposalRequest("State Highway Expansion", ProjectType.STATE_HIGHWAY, districtId, talukaId,
                departmentId, new BigDecimal("60"), new BigDecimal("150"), Set.of(villageId), "Along NH-52",
                "Expansion of existing state highway", LocalDate.of(2027, 1, 1), LocalDate.of(2028, 12, 31));
    }

    private void stubGeography() {
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.of(new DistrictRef(districtId, "D", stateId)));
        when(lookup.findActiveTaluka(talukaId)).thenReturn(Optional.of(new TalukaRef(talukaId, "T", districtId)));
        when(lookup.departmentIsActive(departmentId)).thenReturn(true);
        when(lookup.findActiveVillages(any())).thenReturn(List.of(new VillageRef(villageId, "V", districtId)));
    }

    private Proposal proposal(ProposalStatus status) {
        Proposal p = new Proposal();
        ReflectionTestUtils.setField(p, "id", proposalId);
        p.setOwnerUserId(ownerId);
        p.setStatus(status);
        p.setTitle("State Highway Expansion");
        p.setProjectType(ProjectType.STATE_HIGHWAY);
        p.setStateId(stateId);
        p.setDistrictId(districtId);
        p.setTalukaId(talukaId);
        p.setDepartmentId(departmentId);
        p.setLengthKm(new BigDecimal("60"));
        p.setEstimatedLandAreaHa(new BigDecimal("150"));
        p.setDescription("Expansion of existing state highway");
        p.setPlannedStartDate(LocalDate.of(2027, 1, 1));
        p.setPlannedEndDate(LocalDate.of(2028, 12, 31));
        p.getVillageIds().add(villageId);
        return p;
    }

    private Proposal stored(ProposalStatus status) {
        Proposal p = proposal(status);
        lenient().when(proposals.findById(proposalId)).thenReturn(Optional.of(p));
        lenient().when(proposals.findByIdForUpdate(proposalId)).thenReturn(Optional.of(p));
        return p;
    }

    // ------------------------------------------------------------------ create

    @Test
    void create_validRequest_savesADraft_recordsHistoryAndAudit() {
        stubGeography();

        ProposalResponse response = service.create(request(), consultant);

        assertThat(response.status()).isEqualTo(ProposalStatus.DRAFT);
        assertThat(response.proposalNumber()).isNull();
        assertThat(response.stateId()).isEqualTo(stateId);
        assertThat(response.ownerUserId()).isEqualTo(ownerId);
        assertThat(response.availableActions()).containsExactly(ProposalWorkflow.SUBMIT);
        verify(geoScope).requireDistrictAccess(consultant, districtId);
        verify(history).save(any(ProposalStatusHistory.class));
        verify(audit).record(eq("CREATE"), eq("Proposal"), any(), anyString());
    }

    @Test
    void create_unknownDistrict_isRejected() {
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request(), consultant)).isInstanceOf(InvalidRequestException.class);
        verify(proposals, never()).saveAndFlush(any());
    }

    @Test
    void create_districtOutsideTheConsultantsScope_isForbidden() {
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.of(new DistrictRef(districtId, "D", stateId)));
        doThrow(new AccessDeniedException("no access")).when(geoScope).requireDistrictAccess(consultant, districtId);

        assertThatThrownBy(() -> service.create(request(), consultant)).isInstanceOf(AccessDeniedException.class);
        verify(proposals, never()).saveAndFlush(any());
    }

    @Test
    void create_talukaOfAnotherDistrict_isRejected() {
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.of(new DistrictRef(districtId, "D", stateId)));
        when(lookup.findActiveTaluka(talukaId)).thenReturn(Optional.of(new TalukaRef(talukaId, "T", UUID.randomUUID())));

        assertThatThrownBy(() -> service.create(request(), consultant))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("taluka");
    }

    @Test
    void create_unknownDepartment_isRejected() {
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.of(new DistrictRef(districtId, "D", stateId)));
        when(lookup.findActiveTaluka(talukaId)).thenReturn(Optional.of(new TalukaRef(talukaId, "T", districtId)));
        when(lookup.departmentIsActive(departmentId)).thenReturn(false);

        assertThatThrownBy(() -> service.create(request(), consultant)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void create_villageOfAnotherDistrict_isRejected() {
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.of(new DistrictRef(districtId, "D", stateId)));
        when(lookup.findActiveTaluka(talukaId)).thenReturn(Optional.of(new TalukaRef(talukaId, "T", districtId)));
        when(lookup.departmentIsActive(departmentId)).thenReturn(true);
        when(lookup.findActiveVillages(any())).thenReturn(List.of(new VillageRef(villageId, "Faraway", UUID.randomUUID())));

        assertThatThrownBy(() -> service.create(request(), consultant))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Faraway");
    }

    @Test
    void create_unknownVillage_isRejected() {
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.of(new DistrictRef(districtId, "D", stateId)));
        when(lookup.findActiveTaluka(talukaId)).thenReturn(Optional.of(new TalukaRef(talukaId, "T", districtId)));
        when(lookup.departmentIsActive(departmentId)).thenReturn(true);
        when(lookup.findActiveVillages(any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.create(request(), consultant)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void create_roadWithoutLength_isRejected() {
        ProposalRequest noLength = new ProposalRequest("Road", ProjectType.RURAL_ROAD, districtId, null, departmentId,
                null, new BigDecimal("10"), Set.of(villageId), null, "desc", LocalDate.of(2027, 1, 1), LocalDate.of(2027, 6, 1));

        assertThatThrownBy(() -> service.create(noLength, consultant))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Length");
    }

    @Test
    void create_endDateNotAfterStartDate_isRejected() {
        ProposalRequest badDates = new ProposalRequest("Dam", ProjectType.DAM, districtId, null, departmentId,
                null, new BigDecimal("10"), Set.of(villageId), null, "desc", LocalDate.of(2027, 6, 1), LocalDate.of(2027, 6, 1));

        assertThatThrownBy(() -> service.create(badDates, consultant)).isInstanceOf(InvalidRequestException.class);
    }

    // ------------------------------------------------------------------ update

    @Test
    void update_byAnotherUser_isForbidden() {
        stored(ProposalStatus.DRAFT);

        assertThatThrownBy(() -> service.update(proposalId, request(), otherConsultant))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void update_afterSubmission_isAConflict() {
        stored(ProposalStatus.SUBMITTED);

        assertThatThrownBy(() -> service.update(proposalId, request(), consultant))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void update_proposalTheCallerCannotSee_isNotFound() {
        stored(ProposalStatus.DRAFT);
        when(access.canView(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service.update(proposalId, request(), consultant))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void update_whileClarificationIsRequested_isAllowed() {
        stored(ProposalStatus.CLARIFICATION_REQUESTED);
        stubGeography();

        ProposalResponse response = service.update(proposalId, request(), consultant);

        assertThat(response.status()).isEqualTo(ProposalStatus.CLARIFICATION_REQUESTED);
        verify(audit).record(eq("UPDATE"), eq("Proposal"), any(), anyString());
    }

    // ------------------------------------------------------------------ workflow

    @Test
    void submit_firstTime_generatesTheNumber_snapshotsVersionOne_andNotifiesOfficers() {
        stored(ProposalStatus.DRAFT);
        when(proposals.nextNumber()).thenReturn(7L);
        when(lookup.findUsersByRoleWithDistrictAccess("SCRUTINY_OFFICER", districtId))
                .thenReturn(List.of(new UserRef(officerId, "officer")));

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.SUBMIT, null, consultant);

        assertThat(response.status()).isEqualTo(ProposalStatus.SUBMITTED);
        assertThat(response.proposalNumber()).isEqualTo("PRP-2026-000007");
        assertThat(response.versionNo()).isEqualTo(1);
        ArgumentCaptor<ProposalVersion> version = ArgumentCaptor.forClass(ProposalVersion.class);
        verify(versions).save(version.capture());
        assertThat(version.getValue().getVersionNo()).isEqualTo(1);
        assertThat(version.getValue().getSnapshot()).contains("title=State Highway Expansion");
        verify(notifications).notify(eq(officerId), anyString(), anyString(), anyString(), eq("Proposal"), eq(proposalId));
        verify(audit).record(eq("SUBMIT"), eq("Proposal"), eq(proposalId), anyString());
    }

    @Test
    void submit_byAnotherConsultant_isForbidden() {
        stored(ProposalStatus.DRAFT);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.SUBMIT, null, otherConsultant))
                .isInstanceOf(AccessDeniedException.class);
        verify(proposals, never()).nextNumber();
    }

    @Test
    void submit_twice_isAnInvalidTransition() {
        stored(ProposalStatus.SUBMITTED);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.SUBMIT, null, consultant))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void startScrutiny_movesToUnderScrutiny_andTellsTheOwner() {
        stored(ProposalStatus.SUBMITTED);

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.START_SCRUTINY, null, officer);

        assertThat(response.status()).isEqualTo(ProposalStatus.UNDER_SCRUTINY);
        verify(notifications).notify(eq(ownerId), anyString(), anyString(), anyString(), eq("Proposal"), eq(proposalId));
    }

    @Test
    void startScrutiny_byTheProposalOwner_isForbidden() {
        stored(ProposalStatus.SUBMITTED);
        CurrentActor ownerWhoIsAlsoAnOfficer = new CurrentActor(ownerId, "dual", Set.of("CONSULTANT", "SCRUTINY_OFFICER"),
                Set.of("PROPOSAL_CREATE", "PROPOSAL_READ", "PROPOSAL_SCRUTINIZE"));

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.START_SCRUTINY, null, ownerWhoIsAlsoAnOfficer))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("own proposal");
    }

    @Test
    void clarification_withoutAReason_isRejected() {
        stored(ProposalStatus.UNDER_SCRUTINY);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.REQUEST_CLARIFICATION, " ", officer))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void clarification_withAReason_isRecordedInTheHistory() {
        stored(ProposalStatus.UNDER_SCRUTINY);

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.REQUEST_CLARIFICATION,
                "Survey numbers are missing", officer);

        assertThat(response.status()).isEqualTo(ProposalStatus.CLARIFICATION_REQUESTED);
        ArgumentCaptor<ProposalStatusHistory> entry = ArgumentCaptor.forClass(ProposalStatusHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getReason()).isEqualTo("Survey numbers are missing");
        assertThat(entry.getValue().getFromStatus()).isEqualTo(ProposalStatus.UNDER_SCRUTINY);
        assertThat(entry.getValue().getActorUsername()).isEqualTo("officer");
        verify(notifications).notify(eq(ownerId), anyString(), anyString(), anyString(), eq("Proposal"), eq(proposalId));
    }

    @Test
    void resubmit_incrementsTheVersion_andKeepsTheNumber() {
        Proposal p = stored(ProposalStatus.CLARIFICATION_REQUESTED);
        p.setProposalNumber("PRP-2026-000007");
        p.setVersionNo(1);

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.RESUBMIT, null, consultant);

        assertThat(response.status()).isEqualTo(ProposalStatus.SUBMITTED);
        assertThat(response.proposalNumber()).isEqualTo("PRP-2026-000007");
        assertThat(response.versionNo()).isEqualTo(2);
        verify(proposals, never()).nextNumber();
        ArgumentCaptor<ProposalVersion> version = ArgumentCaptor.forClass(ProposalVersion.class);
        verify(versions).save(version.capture());
        assertThat(version.getValue().getVersionNo()).isEqualTo(2);
    }

    @Test
    void recommend_recordsTheRecommender_andNotifiesTheCompetentAuthorities() {
        Proposal p = stored(ProposalStatus.UNDER_SCRUTINY);
        when(lookup.findUsersByRoleWithDistrictAccess("COMPETENT_AUTHORITY", districtId))
                .thenReturn(List.of(new UserRef(authorityId, "authority")));

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.RECOMMEND, "Looks complete", officer);

        assertThat(response.status()).isEqualTo(ProposalStatus.RECOMMENDED);
        assertThat(p.getRecommendedByUserId()).isEqualTo(officerId);
        verify(notifications).notify(eq(authorityId), anyString(), anyString(), anyString(), eq("Proposal"), eq(proposalId));
    }

    @Test
    void approve_createsTheProject_andTellsTheOwner() {
        Proposal p = stored(ProposalStatus.RECOMMENDED);
        p.setRecommendedByUserId(officerId);
        when(projects.nextNumber()).thenReturn(3L);
        when(projects.saveAndFlush(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.APPROVE, "Approved", authority);

        assertThat(response.status()).isEqualTo(ProposalStatus.APPROVED);
        assertThat(response.projectCode()).isEqualTo("PRJ-2026-000003");
        ArgumentCaptor<Project> project = ArgumentCaptor.forClass(Project.class);
        verify(projects).saveAndFlush(project.capture());
        assertThat(project.getValue().getProposalId()).isEqualTo(proposalId);
        assertThat(project.getValue().getApprovedByUserId()).isEqualTo(authorityId);
        assertThat(project.getValue().getOwnerUserId()).isEqualTo(ownerId);
        assertThat(project.getValue().getVillageIds()).containsExactly(villageId);
        verify(audit).record(eq("CREATE"), eq("Project"), any(), anyString());
        verify(notifications).notify(eq(ownerId), anyString(), anyString(), anyString(), eq("Proposal"), eq(proposalId));
    }

    @Test
    void approve_bySomeoneWhoAlsoRecommended_isForbidden() {
        Proposal p = stored(ProposalStatus.RECOMMENDED);
        p.setRecommendedByUserId(authorityId);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.APPROVE, null, authority))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("recommended");
        verify(projects, never()).saveAndFlush(any());
    }

    @Test
    void approve_beforeRecommendation_isAnInvalidTransition() {
        stored(ProposalStatus.UNDER_SCRUTINY);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.APPROVE, null, authority))
                .isInstanceOf(InvalidTransitionException.class);
        verify(projects, never()).saveAndFlush(any());
    }

    @Test
    void approve_withoutThePermission_isForbidden() {
        stored(ProposalStatus.RECOMMENDED);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.APPROVE, null, officer))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void reject_duringScrutiny_usesTheScrutinyRejectionAction() {
        stored(ProposalStatus.UNDER_SCRUTINY);

        ProposalResponse response = service.reject(proposalId, "Not viable", officer);

        assertThat(response.status()).isEqualTo(ProposalStatus.REJECTED);
        ArgumentCaptor<ProposalStatusHistory> entry = ArgumentCaptor.forClass(ProposalStatusHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getAction()).isEqualTo(ProposalWorkflow.REJECT_SCRUTINY);
        assertThat(entry.getValue().getReason()).isEqualTo("Not viable");
    }

    @Test
    void reject_afterRecommendation_usesTheDecisionAction() {
        Proposal p = stored(ProposalStatus.RECOMMENDED);
        p.setRecommendedByUserId(officerId);

        ProposalResponse response = service.reject(proposalId, "Budget not available", authority);

        assertThat(response.status()).isEqualTo(ProposalStatus.REJECTED);
        ArgumentCaptor<ProposalStatusHistory> entry = ArgumentCaptor.forClass(ProposalStatusHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getAction()).isEqualTo(ProposalWorkflow.REJECT);
    }

    @Test
    void reject_withoutAReason_isRejected() {
        stored(ProposalStatus.UNDER_SCRUTINY);

        assertThatThrownBy(() -> service.reject(proposalId, null, officer)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void reject_aDraft_isAnInvalidTransition() {
        stored(ProposalStatus.DRAFT);

        assertThatThrownBy(() -> service.reject(proposalId, "no", officer)).isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void reopen_byOwner_returnsToDraft_keepingNumberVersionsAndHistory() {
        Proposal p = stored(ProposalStatus.REJECTED);
        p.setProposalNumber("PRP-2026-000007");
        p.setVersionNo(2);
        p.setSubmittedAt(NOW);
        when(projects.findByProposalId(proposalId)).thenReturn(Optional.empty());

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.REOPEN,
                "New survey numbers are available", consultant);

        assertThat(response.status()).isEqualTo(ProposalStatus.DRAFT);
        assertThat(response.proposalNumber()).isEqualTo("PRP-2026-000007");
        assertThat(response.versionNo()).isEqualTo(2);
        assertThat(p.getSubmittedAt()).isEqualTo(NOW);
        ArgumentCaptor<ProposalStatusHistory> entry = ArgumentCaptor.forClass(ProposalStatusHistory.class);
        verify(history).save(entry.capture());
        assertThat(entry.getValue().getFromStatus()).isEqualTo(ProposalStatus.REJECTED);
        assertThat(entry.getValue().getToStatus()).isEqualTo(ProposalStatus.DRAFT);
        assertThat(entry.getValue().getAction()).isEqualTo(ProposalWorkflow.REOPEN);
        assertThat(entry.getValue().getReason()).isEqualTo("New survey numbers are available");
        verify(audit).record(eq("REOPEN"), eq("Proposal"), eq(proposalId), anyString());
        verify(notifications).notify(eq(ownerId), anyString(), anyString(), anyString(), eq("Proposal"), eq(proposalId));
        verify(versions, never()).save(any());
        verify(proposals, never()).nextNumber();
        verify(projects, never()).saveAndFlush(any());
        verify(acquisitionCaseInitiator, never()).initiateForApprovedProject(any(), any(), any());
    }

    @Test
    void reopen_byAnotherConsultant_isForbidden() {
        stored(ProposalStatus.REJECTED);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.REOPEN, "reason", otherConsultant))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("created the proposal");
    }

    @Test
    void reopen_withoutAReason_isRejected() {
        stored(ProposalStatus.REJECTED);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.REOPEN, " ", consultant))
                .isInstanceOf(InvalidRequestException.class);
        verify(history, never()).save(any(ProposalStatusHistory.class));
    }

    @Test
    void reopen_aDraft_isAnInvalidTransition() {
        stored(ProposalStatus.DRAFT);

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.REOPEN, "reason", consultant))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void reopen_aProposalThatAlreadyHasAProject_isRejected() {
        stored(ProposalStatus.REJECTED);
        when(projects.findByProposalId(proposalId)).thenReturn(Optional.of(new Project()));

        assertThatThrownBy(() -> service.transition(proposalId, ProposalWorkflow.REOPEN, "retry", consultant))
                .isInstanceOf(InvalidTransitionException.class)
                .hasMessageContaining("already has a project");
        verify(history, never()).save(any(ProposalStatusHistory.class));
        verify(notifications, never()).notify(any(), any(), any(), any(), any(), any());
    }

    @Test
    void get_aRejectedProposal_offersReopenOnlyToItsOwner() {
        stored(ProposalStatus.REJECTED);

        assertThat(service.get(proposalId, consultant).availableActions())
                .containsExactly(ProposalWorkflow.REOPEN);
        assertThat(service.get(proposalId, otherConsultant).availableActions()).isEmpty();
        assertThat(service.get(proposalId, officer).availableActions()).isEmpty();
        assertThat(service.get(proposalId, authority).availableActions()).isEmpty();
    }

    // ------------------------------------------------------------------ queries

    @Test
    void get_showsOnlyTheActionsTheCallerMayTakeNow() {
        stored(ProposalStatus.SUBMITTED);

        assertThat(service.get(proposalId, officer).availableActions()).containsExactly(ProposalWorkflow.START_SCRUTINY);
        assertThat(service.get(proposalId, consultant).availableActions()).isEmpty();
        assertThat(service.get(proposalId, authority).availableActions()).isEmpty();
    }

    @Test
    void get_aDraft_offersSubmitOnlyToItsOwner() {
        stored(ProposalStatus.DRAFT);

        assertThat(service.get(proposalId, consultant).availableActions()).containsExactly(ProposalWorkflow.SUBMIT);
        assertThat(service.get(proposalId, otherConsultant).availableActions()).isEmpty();
    }

    @Test
    void get_approvedProposal_includesTheProjectCode() {
        stored(ProposalStatus.APPROVED);
        Project project = new Project();
        project.setCode("PRJ-2026-000009");
        when(projects.findByProposalId(proposalId)).thenReturn(Optional.of(project));
        when(acquisitionCaseInitiator.findCaseNumberByProjectId(any())).thenReturn(Optional.of("ACQ-2026-000009"));

        ProposalResponse response = service.get(proposalId, consultant);
        assertThat(response.projectCode()).isEqualTo("PRJ-2026-000009");
        assertThat(response.acquisitionCaseNumber()).isEqualTo("ACQ-2026-000009");
    }

    @Test
    void repeatedApproval_whenAlreadyApprovedWithCompleteArtifacts_returnsExistingResultWithoutSideEffects() {
        Proposal p = stored(ProposalStatus.APPROVED);
        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", UUID.randomUUID());
        project.setCode("PRJ-2026-000010");
        when(projects.findByProposalId(proposalId)).thenReturn(Optional.of(project));
        when(acquisitionCaseInitiator.findCaseNumberByProjectId(project.getId())).thenReturn(Optional.of("ACQ-2026-000010"));

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.APPROVE, "again", authority);

        assertThat(response.status()).isEqualTo(ProposalStatus.APPROVED);
        assertThat(response.projectCode()).isEqualTo("PRJ-2026-000010");
        assertThat(response.acquisitionCaseNumber()).isEqualTo("ACQ-2026-000010");
        verify(projects, never()).saveAndFlush(any());
        verify(acquisitionCaseInitiator, never()).initiateForApprovedProject(any(), any(), any());
        verify(history, never()).save(any(ProposalStatusHistory.class));
        verify(notifications, never()).notify(any(), any(), any(), any(), any(), any());
    }

    @Test
    void get_approvedProposal_withMultipleExistingCases_failsExplicitlyWithoutArbitrarySelection() {
        stored(ProposalStatus.APPROVED);
        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", UUID.randomUUID());
        project.setCode("PRJ-2026-000011");
        when(projects.findByProposalId(proposalId)).thenReturn(Optional.of(project));
        when(acquisitionCaseInitiator.findCaseNumberByProjectId(project.getId()))
                .thenThrow(new InvalidTransitionException("Multiple acquisition cases exist for project " + project.getId() + "; manual reconciliation is required"));

        assertThatThrownBy(() -> service.get(proposalId, consultant))
                .isInstanceOf(InvalidTransitionException.class)
                .hasMessageContaining("Multiple acquisition cases exist");
    }

    @Test
    void approve_constraintConflict_doesNotQueryForRecoveryInsideAttempt_andReturnsWinnerFromFreshRecovery() {
        Proposal p = stored(ProposalStatus.RECOMMENDED);
        p.setRecommendedByUserId(officerId);
        Project winner = new Project();
        UUID projectId = UUID.randomUUID();
        ReflectionTestUtils.setField(winner, "id", projectId);
        winner.setCode("PRJ-2026-000099");

        // Attempt sees no project, tries to create, DB uniqueness aborts attempt transaction.
        // First find (pre-check inside attempt) -> empty, second find (inside fresh recovery after rollback) -> winner.
        when(projects.findByProposalId(proposalId)).thenReturn(Optional.empty(), Optional.of(winner));
        when(projects.saveAndFlush(any(Project.class))).thenThrow(new org.springframework.dao.DataIntegrityViolationException("dup"));

        // Fresh recovery sees approved + complete artifacts.
        Proposal approved = proposal(ProposalStatus.APPROVED);
        when(proposals.findCurrentById(proposalId)).thenReturn(Optional.of(approved));
        when(acquisitionCaseInitiator.findCaseNumberByProjectId(projectId)).thenReturn(Optional.of("ACQ-2026-000099"));

        ProposalResponse response = service.transition(proposalId, ProposalWorkflow.APPROVE, "Approved", authority);

        assertThat(response.status()).isEqualTo(ProposalStatus.APPROVED);
        assertThat(response.projectCode()).isEqualTo("PRJ-2026-000099");
        assertThat(response.acquisitionCaseNumber()).isEqualTo("ACQ-2026-000099");
        // Pre-check in attempt + one fresh recovery read only (no in-aborted-tx recovery SELECT after save failure).
        verify(projects, org.mockito.Mockito.times(2)).findByProposalId(proposalId);
        verify(history, never()).save(any(ProposalStatusHistory.class));
        verify(notifications, never()).notify(any(), any(), any(), any(), any(), any());
    }

    @Test
    void get_proposalTheCallerCannotSee_isNotFound() {
        stored(ProposalStatus.DRAFT);
        when(access.canView(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service.get(proposalId, consultant)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void list_appliesTheVisibilityFilter_andPaging() {
        when(access.<Proposal>visibleTo(consultant)).thenReturn((root, query, cb) -> cb.conjunction());
        when(proposals.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(proposal(ProposalStatus.DRAFT))));

        PageResponse<ProposalResponse> page = service.list(ProposalStatus.DRAFT, districtId, 0, 20, consultant);

        assertThat(page.content()).hasSize(1);
        verify(access).visibleTo(consultant);
    }

    @Test
    void history_andVersions_requireVisibility() {
        stored(ProposalStatus.DRAFT);
        when(history.findByProposalIdOrderByOccurredAtAsc(proposalId)).thenReturn(List.of(
                new ProposalStatusHistory(proposalId, null, ProposalStatus.DRAFT, "CREATE", ownerId, "consultant", null, NOW)));
        when(versions.findByProposalIdOrderByVersionNoAsc(proposalId)).thenReturn(List.of());

        assertThat(service.history(proposalId, consultant)).hasSize(1);
        assertThat(service.versions(proposalId, consultant)).isEmpty();
    }
}
