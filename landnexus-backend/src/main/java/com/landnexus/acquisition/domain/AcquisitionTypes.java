package com.landnexus.acquisition.domain;

public final class AcquisitionTypes {

    private AcquisitionTypes() {
    }

    public enum CaseStatus {
        INITIATED, SURVEY_IN_PROGRESS, VERIFICATION_COMPLETE, NOTIFICATION_ISSUED, READY_FOR_AWARD,
        AWARD_DECLARED, POSSESSION_TAKEN, CLOSED, CANCELLED
    }

    /** The legal framework the case runs under. Not every state or project uses the same law. */
    public enum AcquisitionFramework { LARR_2013, NATIONAL_HIGHWAYS_ACT_1956, RAILWAYS_ACT_1989, STATE_ACT, OTHER }

    public enum SurveyStatus { SUBMITTED, VERIFIED, REJECTED }
}