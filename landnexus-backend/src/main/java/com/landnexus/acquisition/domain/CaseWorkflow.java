package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.shared.workflow.Transition;
import com.landnexus.shared.workflow.WorkflowDefinition;
import java.util.List;

/**
 * INITIATED -START_SURVEY-> SURVEY_IN_PROGRESS -COMPLETE_VERIFICATION-> VERIFICATION_COMPLETE
 * -ISSUE_NOTIFICATION-> NOTIFICATION_ISSUED -CLOSE_OBJECTION_WINDOW-> READY_FOR_AWARD -DECLARE_AWARD-> AWARD_DECLARED
 * -COMPLETE_POSSESSION-> POSSESSION_TAKEN -CLOSE-> CLOSED
 * CANCEL (reason required) is possible until the award is declared.
 */
public final class CaseWorkflow {

    public static final String START_SURVEY = "START_SURVEY";
    public static final String COMPLETE_VERIFICATION = "COMPLETE_VERIFICATION";
    public static final String ISSUE_NOTIFICATION = "ISSUE_NOTIFICATION";
    public static final String CLOSE_OBJECTION_WINDOW = "CLOSE_OBJECTION_WINDOW";
    public static final String DECLARE_AWARD = "DECLARE_AWARD";
    public static final String COMPLETE_POSSESSION = "COMPLETE_POSSESSION";
    public static final String CLOSE = "CLOSE";
    public static final String CANCEL = "CANCEL";

    public static final String MANAGE = "ACQUISITION_MANAGE";
    public static final String DECIDE = "ACQUISITION_DECIDE";

    public static final WorkflowDefinition<CaseStatus> DEFINITION = new WorkflowDefinition<>(List.of(
            t(CaseStatus.INITIATED, START_SURVEY, CaseStatus.SURVEY_IN_PROGRESS, MANAGE, false),
            t(CaseStatus.SURVEY_IN_PROGRESS, COMPLETE_VERIFICATION, CaseStatus.VERIFICATION_COMPLETE, MANAGE, false),
            t(CaseStatus.VERIFICATION_COMPLETE, ISSUE_NOTIFICATION, CaseStatus.NOTIFICATION_ISSUED, DECIDE, false),
            t(CaseStatus.NOTIFICATION_ISSUED, CLOSE_OBJECTION_WINDOW, CaseStatus.READY_FOR_AWARD, MANAGE, false),
            t(CaseStatus.READY_FOR_AWARD, DECLARE_AWARD, CaseStatus.AWARD_DECLARED, DECIDE, false),
            t(CaseStatus.AWARD_DECLARED, COMPLETE_POSSESSION, CaseStatus.POSSESSION_TAKEN, MANAGE, false),
            t(CaseStatus.POSSESSION_TAKEN, CLOSE, CaseStatus.CLOSED, DECIDE, false),
            t(CaseStatus.INITIATED, CANCEL, CaseStatus.CANCELLED, DECIDE, true),
            t(CaseStatus.SURVEY_IN_PROGRESS, CANCEL, CaseStatus.CANCELLED, DECIDE, true),
            t(CaseStatus.VERIFICATION_COMPLETE, CANCEL, CaseStatus.CANCELLED, DECIDE, true),
            t(CaseStatus.NOTIFICATION_ISSUED, CANCEL, CaseStatus.CANCELLED, DECIDE, true),
            t(CaseStatus.READY_FOR_AWARD, CANCEL, CaseStatus.CANCELLED, DECIDE, true)));

    private CaseWorkflow() {
    }

    private static Transition<CaseStatus> t(CaseStatus from, String action, CaseStatus to, String authority,
                                            boolean reasonRequired) {
        return new Transition<>(from, action, to, authority, reasonRequired);
    }
}