package com.landnexus.shared.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class WorkflowDefinitionTest {

    enum State { OPEN, REVIEW, CLOSED }

    private final WorkflowDefinition<State> definition = new WorkflowDefinition<>(List.of(
            new Transition<>(State.OPEN, "SEND", State.REVIEW, "CAN_SEND", false),
            new Transition<>(State.REVIEW, "CLOSE", State.CLOSED, "CAN_CLOSE", true)));

    @Test
    void allowedAction_returnsTheTransition() {
        Transition<State> t = definition.require(State.OPEN, "SEND", Set.of("CAN_SEND"), null);

        assertThat(t.to()).isEqualTo(State.REVIEW);
    }

    @Test
    void actionNotListedForTheCurrentState_isAnInvalidTransition() {
        assertThatThrownBy(() -> definition.require(State.OPEN, "CLOSE", Set.of("CAN_CLOSE"), "because"))
                .isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> definition.require(State.CLOSED, "SEND", Set.of("CAN_SEND"), null))
                .isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void missingAuthority_isAccessDenied() {
        assertThatThrownBy(() -> definition.require(State.OPEN, "SEND", Set.of("SOMETHING_ELSE"), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void mandatoryReason_isEnforced() {
        assertThatThrownBy(() -> definition.require(State.REVIEW, "CLOSE", Set.of("CAN_CLOSE"), "  "))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> definition.require(State.REVIEW, "CLOSE", Set.of("CAN_CLOSE"), null))
                .isInstanceOf(InvalidRequestException.class);
        assertThat(definition.require(State.REVIEW, "CLOSE", Set.of("CAN_CLOSE"), "done").to()).isEqualTo(State.CLOSED);
    }

    @Test
    void finalState_hasNoTransitions() {
        assertThat(definition.isFinal(State.CLOSED)).isTrue();
        assertThat(definition.isFinal(State.OPEN)).isFalse();
        assertThat(definition.from(State.OPEN)).hasSize(1);
    }

    @Test
    void duplicateTransition_isRejectedAtStartup() {
        assertThatThrownBy(() -> new WorkflowDefinition<>(List.of(
                new Transition<>(State.OPEN, "SEND", State.REVIEW, "A", false),
                new Transition<>(State.OPEN, "SEND", State.CLOSED, "B", false))))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
