package com.landnexus.acquisition.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.CaseStatusHistoryRepository;
import com.landnexus.projects.application.AcquisitionCaseInitiator.InitiatedCase;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.Instant;
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
import org.springframework.test.util.ReflectionTestUtils;

/** Automatic initiation must never create a second case for the same project. */
@ExtendWith(MockitoExtension.class)
class ProposalApprovedCaseInitiatorTest {

    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    @Mock private AcquisitionCaseRepository cases;
    @Mock private CaseStatusHistoryRepository history;
    @Mock private AuditService audit;

    private ProposalApprovedCaseInitiator initiator;
    private Project project;
    private Proposal proposal;
    private CurrentActor actor;

    @BeforeEach
    void setUp() {
        initiator = new ProposalApprovedCaseInitiator(cases, history, audit, Clock.fixed(NOW, ZoneOffset.UTC));
        project = new Project();
        ReflectionTestUtils.setField(project, "id", UUID.randomUUID());
        project.setCode("PRJ-2026-000001");
        project.setStateId(UUID.randomUUID());
        project.setDistrictId(UUID.randomUUID());
        project.setProjectType(ProjectType.STATE_HIGHWAY);
        proposal = new Proposal();
        proposal.setProposalNumber("PROP-2026-000001");
        actor = new CurrentActor(UUID.randomUUID(), "manager", Set.of(), Set.of("ACQUISITION_MANAGE"));
    }

    @Test
    void createsTheFirstCase_andRecordsHistoryAndAudit() {
        when(cases.findAllByProjectId(project.getId())).thenReturn(List.of());
        when(cases.nextNumber()).thenReturn(7L);
        when(cases.saveAndFlush(any(AcquisitionCase.class))).thenAnswer(invocation -> {
            AcquisitionCase saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            return saved;
        });

        Optional<InitiatedCase> result = initiator.initiateForApprovedProject(project, proposal, actor);

        assertThat(result).isPresent();
        assertThat(result.get().caseNumber()).isEqualTo("ACQ-2026-000007");
        verify(history).save(any());
        verify(audit).record(eq("AUTO_INITIATE"), eq("AcquisitionCase"), any(), anyString());
    }

    @Test
    void returnsTheExistingCaseWithoutCreatingAnother() {
        UUID existingId = UUID.randomUUID();
        AcquisitionCase existing = new AcquisitionCase();
        ReflectionTestUtils.setField(existing, "id", existingId);
        existing.setCaseNumber("ACQ-2026-000003");
        existing.setProjectId(project.getId());
        when(cases.findAllByProjectId(project.getId())).thenReturn(List.of(existing));

        Optional<InitiatedCase> result = initiator.initiateForApprovedProject(project, proposal, actor);

        assertThat(result).contains(new InitiatedCase(existingId, "ACQ-2026-000003"));
        verify(cases, never()).nextNumber();
        verify(cases, never()).saveAndFlush(any());
        verify(history, never()).save(any());
        verify(audit, never()).record(any(), any(), any(), any());
    }

    @Test
    void refusesToPickOneWhenLegacyDuplicatesStillExist() {
        when(cases.findAllByProjectId(project.getId()))
                .thenReturn(List.of(new AcquisitionCase(), new AcquisitionCase()));

        assertThatThrownBy(() -> initiator.initiateForApprovedProject(project, proposal, actor))
                .isInstanceOf(InvalidTransitionException.class)
                .hasMessageContaining("Multiple acquisition cases");
    }
}
