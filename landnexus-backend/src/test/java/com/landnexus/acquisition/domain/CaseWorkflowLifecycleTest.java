package com.landnexus.acquisition.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.shared.exception.InvalidTransitionException;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class CaseWorkflowLifecycleTest {

    private static final Set<String> ALL = Set.of("ACQUISITION_MANAGE", "ACQUISITION_DECIDE");

    private CaseStatus next(CaseStatus from, String action) {
        return CaseWorkflow.DEFINITION.require(from, action, ALL, "reason").to();
    }

    @Test
    void fullPath_fromVerificationToClosed() {
        CaseStatus s = next(CaseStatus.VERIFICATION_COMPLETE, CaseWorkflow.ISSUE_NOTIFICATION);
        assertThat(s).isEqualTo(CaseStatus.NOTIFICATION_ISSUED);
        s = next(s, CaseWorkflow.CLOSE_OBJECTION_WINDOW);
        assertThat(s).isEqualTo(CaseStatus.READY_FOR_AWARD);
        s = next(s, CaseWorkflow.DECLARE_AWARD);
        assertThat(s).isEqualTo(CaseStatus.AWARD_DECLARED);
        s = next(s, CaseWorkflow.COMPLETE_POSSESSION);
        assertThat(s).isEqualTo(CaseStatus.POSSESSION_TAKEN);
        assertThat(next(s, CaseWorkflow.CLOSE)).isEqualTo(CaseStatus.CLOSED);
        assertThat(CaseWorkflow.DEFINITION.isFinal(CaseStatus.CLOSED)).isTrue();
    }

    @Test
    void cancel_isPossibleUntilTheAward_butNotAfter() {
        assertThat(next(CaseStatus.NOTIFICATION_ISSUED, CaseWorkflow.CANCEL)).isEqualTo(CaseStatus.CANCELLED);
        assertThat(next(CaseStatus.READY_FOR_AWARD, CaseWorkflow.CANCEL)).isEqualTo(CaseStatus.CANCELLED);
        assertThatThrownBy(() -> next(CaseStatus.AWARD_DECLARED, CaseWorkflow.CANCEL)).isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> next(CaseStatus.POSSESSION_TAKEN, CaseWorkflow.CANCEL)).isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void legalDecisions_needTheDecidePermission() {
        Set<String> managerOnly = Set.of("ACQUISITION_MANAGE");
        for (String action : new String[] {CaseWorkflow.ISSUE_NOTIFICATION}) {
            assertThatThrownBy(() -> CaseWorkflow.DEFINITION.require(CaseStatus.VERIFICATION_COMPLETE, action, managerOnly, null))
                    .isInstanceOf(AccessDeniedException.class);
        }
        assertThatThrownBy(() -> CaseWorkflow.DEFINITION.require(CaseStatus.READY_FOR_AWARD, CaseWorkflow.DECLARE_AWARD, managerOnly, null))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> CaseWorkflow.DEFINITION.require(CaseStatus.POSSESSION_TAKEN, CaseWorkflow.CLOSE, managerOnly, null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void stagesCannotBeSkipped() {
        assertThatThrownBy(() -> next(CaseStatus.VERIFICATION_COMPLETE, CaseWorkflow.DECLARE_AWARD)).isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> next(CaseStatus.NOTIFICATION_ISSUED, CaseWorkflow.COMPLETE_POSSESSION)).isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> next(CaseStatus.AWARD_DECLARED, CaseWorkflow.CLOSE)).isInstanceOf(InvalidTransitionException.class);
    }
}