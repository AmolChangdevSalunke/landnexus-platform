package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.shared.workflow.Transition;
import com.landnexus.shared.workflow.WorkflowDefinition;
import java.util.List;

/**
 * The acquisition case life cycle (part 1). Part 2 adds notification, objections, award, possession and closure
 * as more rows of this one table.
 *
 * INITIATED -START_SURVEY-> SURVEY_IN_PROGRESS -COMPLETE_VERIFICATION-> VERIFICATION_COMPLETE
 * any of those three -CANCEL (reason required)-> CANCELLED
 */
public final class CaseWorkflow {

    public static final String START_SURVEY = "START_SURVEY";
    public static final String COMPLETE_VERIFICATION = "COMPLETE_VERIFICATION";
    public static final String CANCEL = "CANCEL";

    public static final String MANAGE = "ACQUISITION_MANAGE";
    public static final String DECIDE = "ACQUISITION_DECIDE";

    public static final WorkflowDefinition<CaseStatus> DEFINITION = new WorkflowDefinition<>(List.of(
            t(CaseStatus.INITIATED, START_SURVEY, CaseStatus.SURVEY_IN_PROGRESS, MANAGE, false),
            t(CaseStatus.SURVEY_IN_PROGRESS, COMPLETE_VERIFICATION, CaseStatus.VERIFICATION_COMPLETE, MANAGE, false),
            t(CaseStatus.INITIATED, CANCEL, CaseStatus.CANCELLED, DECIDE, true),
            t(CaseStatus.SURVEY_IN_PROGRESS, CANCEL, CaseStatus.CANCELLED, DECIDE, true),
            t(CaseStatus.VERIFICATION_COMPLETE, CANCEL, CaseStatus.CANCELLED, DECIDE, true)));

    private CaseWorkflow() {
    }

    private static Transition<CaseStatus> t(CaseStatus from, String action, CaseStatus to, String authority,
                                            boolean reasonRequired) {
        return new Transition<>(from, action, to, authority, reasonRequired);
    }
}