package com.landnexus.projects.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class ProposalWorkflowTest {

    private static final Set<String> ALL = Set.of("PROPOSAL_CREATE", "PROPOSAL_SCRUTINIZE", "PROPOSAL_DECIDE");

    private ProposalStatus next(ProposalStatus from, String action, String reason) {
        return ProposalWorkflow.DEFINITION.require(from, action, ALL, reason).to();
    }

    @Test
    void happyPath_goesFromDraftToApproved() {
        ProposalStatus s = next(ProposalStatus.DRAFT, ProposalWorkflow.SUBMIT, null);
        assertThat(s).isEqualTo(ProposalStatus.SUBMITTED);
        s = next(s, ProposalWorkflow.START_SCRUTINY, null);
        assertThat(s).isEqualTo(ProposalStatus.UNDER_SCRUTINY);
        s = next(s, ProposalWorkflow.RECOMMEND, null);
        assertThat(s).isEqualTo(ProposalStatus.RECOMMENDED);
        s = next(s, ProposalWorkflow.APPROVE, null);
        assertThat(s).isEqualTo(ProposalStatus.APPROVED);
    }

    @Test
    void clarificationLoop_returnsToSubmitted() {
        ProposalStatus s = next(ProposalStatus.UNDER_SCRUTINY, ProposalWorkflow.REQUEST_CLARIFICATION, "missing survey numbers");
        assertThat(s).isEqualTo(ProposalStatus.CLARIFICATION_REQUESTED);
        assertThat(next(s, ProposalWorkflow.RESUBMIT, null)).isEqualTo(ProposalStatus.SUBMITTED);
    }

    @Test
    void rejection_isPossibleDuringScrutinyAndAfterRecommendation() {
        assertThat(next(ProposalStatus.UNDER_SCRUTINY, ProposalWorkflow.REJECT_SCRUTINY, "not viable"))
                .isEqualTo(ProposalStatus.REJECTED);
        assertThat(next(ProposalStatus.RECOMMENDED, ProposalWorkflow.REJECT, "budget"))
                .isEqualTo(ProposalStatus.REJECTED);
    }

    @Test
    void reasonIsMandatoryForClarificationEveryRejectionAndReopening() {
        assertThatThrownBy(() -> next(ProposalStatus.UNDER_SCRUTINY, ProposalWorkflow.REQUEST_CLARIFICATION, null))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> next(ProposalStatus.UNDER_SCRUTINY, ProposalWorkflow.REJECT_SCRUTINY, " "))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> next(ProposalStatus.RECOMMENDED, ProposalWorkflow.REJECT, null))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> next(ProposalStatus.REJECTED, ProposalWorkflow.REOPEN, null))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void aRejectedProposalCanBeReopenedAsADraftByItsOwner() {
        assertThat(next(ProposalStatus.REJECTED, ProposalWorkflow.REOPEN, "New survey numbers"))
                .isEqualTo(ProposalStatus.DRAFT);
        assertThat(ProposalWorkflow.OWNER_ACTIONS).contains(ProposalWorkflow.REOPEN);
    }

    @Test
    void reopeningNeedsTheCreatePermission() {
        assertThatThrownBy(() -> ProposalWorkflow.DEFINITION.require(
                ProposalStatus.REJECTED, ProposalWorkflow.REOPEN, Set.of("PROPOSAL_SCRUTINIZE"), "reason"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void approvedIsFinal_andRejectionIsFinalOnlyUntilTheOwnerReopens() {
        assertThat(ProposalWorkflow.DEFINITION.isFinal(ProposalStatus.APPROVED)).isTrue();
        assertThat(ProposalWorkflow.DEFINITION.isFinal(ProposalStatus.REJECTED)).isFalse();
        assertThatThrownBy(() -> next(ProposalStatus.APPROVED, ProposalWorkflow.APPROVE, null))
                .isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> next(ProposalStatus.APPROVED, ProposalWorkflow.REOPEN, "retry"))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void shortcuts_areImpossible() {
        assertThatThrownBy(() -> next(ProposalStatus.DRAFT, ProposalWorkflow.APPROVE, null))
                .isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> next(ProposalStatus.SUBMITTED, ProposalWorkflow.APPROVE, null))
                .isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> next(ProposalStatus.UNDER_SCRUTINY, ProposalWorkflow.APPROVE, null))
                .isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> next(ProposalStatus.SUBMITTED, ProposalWorkflow.RECOMMEND, null))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void eachActionNeedsItsOwnPermission() {
        assertThatThrownBy(() -> ProposalWorkflow.DEFINITION.require(
                ProposalStatus.DRAFT, ProposalWorkflow.SUBMIT, Set.of("PROPOSAL_SCRUTINIZE"), null))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> ProposalWorkflow.DEFINITION.require(
                ProposalStatus.RECOMMENDED, ProposalWorkflow.APPROVE, Set.of("PROPOSAL_SCRUTINIZE"), null))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> ProposalWorkflow.DEFINITION.require(
                ProposalStatus.UNDER_SCRUTINY, ProposalWorkflow.RECOMMEND, Set.of("PROPOSAL_DECIDE"), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void projectTypes_linearOnesNeedALength() {
        assertThat(ProjectType.values()).hasSize(12);
        assertThat(ProjectType.STATE_HIGHWAY.isLinear()).isTrue();
        assertThat(ProjectType.RAILWAY.isLinear()).isTrue();
        assertThat(ProjectType.DAM.isLinear()).isFalse();
    }
}
