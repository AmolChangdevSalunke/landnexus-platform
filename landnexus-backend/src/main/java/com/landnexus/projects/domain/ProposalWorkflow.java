package com.landnexus.projects.domain;

import com.landnexus.shared.workflow.Transition;
import com.landnexus.shared.workflow.WorkflowDefinition;
import java.util.List;
import java.util.Set;

/**
 * The proposal life cycle. This table is the single source of truth: who may do what, from which state.
 *
 * DRAFT -SUBMIT-> SUBMITTED -START_SCRUTINY-> UNDER_SCRUTINY
 * UNDER_SCRUTINY -REQUEST_CLARIFICATION-> CLARIFICATION_REQUESTED -RESUBMIT-> SUBMITTED
 * UNDER_SCRUTINY -RECOMMEND-> RECOMMENDED -APPROVE-> APPROVED (a project is created)
 * UNDER_SCRUTINY -REJECT_SCRUTINY-> REJECTED   and   RECOMMENDED -REJECT-> REJECTED
 */
public final class ProposalWorkflow {

    public static final String SUBMIT = "SUBMIT";
    public static final String START_SCRUTINY = "START_SCRUTINY";
    public static final String REQUEST_CLARIFICATION = "REQUEST_CLARIFICATION";
    public static final String RESUBMIT = "RESUBMIT";
    public static final String RECOMMEND = "RECOMMEND";
    public static final String REJECT_SCRUTINY = "REJECT_SCRUTINY";
    public static final String APPROVE = "APPROVE";
    public static final String REJECT = "REJECT";

    public static final String PERMISSION_CREATE = "PROPOSAL_CREATE";
    public static final String PERMISSION_SCRUTINIZE = "PROPOSAL_SCRUTINIZE";
    public static final String PERMISSION_DECIDE = "PROPOSAL_DECIDE";

    /** Only the consultant who owns the proposal may do these. */
    public static final Set<String> OWNER_ACTIONS = Set.of(SUBMIT, RESUBMIT);

    /** Nobody may review (scrutinise or decide) their own proposal. */
    public static final Set<String> REVIEWER_ACTIONS =
            Set.of(START_SCRUTINY, REQUEST_CLARIFICATION, RECOMMEND, REJECT_SCRUTINY, APPROVE, REJECT);

    /** The officer who recommended a proposal may not also approve or reject it (maker-checker). */
    public static final Set<String> DECISION_ACTIONS = Set.of(APPROVE, REJECT);

    public static final WorkflowDefinition<ProposalStatus> DEFINITION = new WorkflowDefinition<>(List.of(
            t(ProposalStatus.DRAFT, SUBMIT, ProposalStatus.SUBMITTED, PERMISSION_CREATE, false),
            t(ProposalStatus.SUBMITTED, START_SCRUTINY, ProposalStatus.UNDER_SCRUTINY, PERMISSION_SCRUTINIZE, false),
            t(ProposalStatus.UNDER_SCRUTINY, REQUEST_CLARIFICATION, ProposalStatus.CLARIFICATION_REQUESTED,
                    PERMISSION_SCRUTINIZE, true),
            t(ProposalStatus.CLARIFICATION_REQUESTED, RESUBMIT, ProposalStatus.SUBMITTED, PERMISSION_CREATE, false),
            t(ProposalStatus.UNDER_SCRUTINY, RECOMMEND, ProposalStatus.RECOMMENDED, PERMISSION_SCRUTINIZE, false),
            t(ProposalStatus.UNDER_SCRUTINY, REJECT_SCRUTINY, ProposalStatus.REJECTED, PERMISSION_SCRUTINIZE, true),
            t(ProposalStatus.RECOMMENDED, APPROVE, ProposalStatus.APPROVED, PERMISSION_DECIDE, false),
            t(ProposalStatus.RECOMMENDED, REJECT, ProposalStatus.REJECTED, PERMISSION_DECIDE, true)));

    private ProposalWorkflow() {
    }

    private static Transition<ProposalStatus> t(ProposalStatus from, String action, ProposalStatus to,
                                                String authority, boolean reasonRequired) {
        return new Transition<>(from, action, to, authority, reasonRequired);
    }
}
