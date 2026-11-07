package com.landnexus.acquisition.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class CaseWorkflowTest {

    private static final Set<String> ALL = Set.of("ACQUISITION_MANAGE", "ACQUISITION_DECIDE");

    @Test
    void survey_stages_followInOrder() {
        assertThat(CaseWorkflow.DEFINITION.require(CaseStatus.INITIATED, CaseWorkflow.START_SURVEY, ALL, null).to())
                .isEqualTo(CaseStatus.SURVEY_IN_PROGRESS);
        assertThat(CaseWorkflow.DEFINITION.require(CaseStatus.SURVEY_IN_PROGRESS, CaseWorkflow.COMPLETE_VERIFICATION, ALL, null).to())
                .isEqualTo(CaseStatus.VERIFICATION_COMPLETE);
    }

    @Test
    void stagesCannotBeSkipped() {
        assertThatThrownBy(() -> CaseWorkflow.DEFINITION.require(CaseStatus.INITIATED, CaseWorkflow.COMPLETE_VERIFICATION, ALL, null))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void cancelNeedsTheDecisionPermission_andAReason() {
        assertThatThrownBy(() -> CaseWorkflow.DEFINITION.require(CaseStatus.INITIATED, CaseWorkflow.CANCEL, Set.of("ACQUISITION_MANAGE"), "x"))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> CaseWorkflow.DEFINITION.require(CaseStatus.INITIATED, CaseWorkflow.CANCEL, ALL, " "))
                .isInstanceOf(InvalidRequestException.class);
        assertThat(CaseWorkflow.DEFINITION.require(CaseStatus.VERIFICATION_COMPLETE, CaseWorkflow.CANCEL, ALL, "withdrawn").to())
                .isEqualTo(CaseStatus.CANCELLED);
    }

    @Test
    void cancelledIsFinal() {
        assertThat(CaseWorkflow.DEFINITION.isFinal(CaseStatus.CANCELLED)).isTrue();
    }
}