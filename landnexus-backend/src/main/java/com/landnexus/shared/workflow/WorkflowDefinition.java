package com.landnexus.shared.workflow;

import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;

/**
 * A deterministic state machine: the only way to change state is a listed transition.
 * The rules live in the backend; the frontend can only ask for an action and is told yes or no.
 */
public class WorkflowDefinition<S extends Enum<S>> {

    private final List<Transition<S>> transitions;

    public WorkflowDefinition(List<Transition<S>> transitions) {
        Set<String> seen = new HashSet<>();
        for (Transition<S> transition : transitions) {
            if (!seen.add(transition.from() + "/" + transition.action())) {
                throw new IllegalArgumentException(
                        "Duplicate transition " + transition.action() + " from " + transition.from());
            }
        }
        this.transitions = List.copyOf(transitions);
    }

    public Optional<Transition<S>> find(S from, String action) {
        return transitions.stream()
                .filter(t -> t.from() == from && t.action().equals(action))
                .findFirst();
    }

    public List<Transition<S>> from(S state) {
        return transitions.stream().filter(t -> t.from() == state).toList();
    }

    public boolean isFinal(S state) {
        return from(state).isEmpty();
    }

    /**
     * Checks, in this order: the action exists in the current state (409), the caller holds the authority (403),
     * and a reason was given when one is mandatory (400). Returns the transition to apply.
     */
    public Transition<S> require(S current, String action, Set<String> authorities, String reason) {
        Transition<S> transition = find(current, action).orElseThrow(() -> new InvalidTransitionException(
                "Action " + action + " is not allowed while the status is " + current));
        if (!authorities.contains(transition.requiredAuthority())) {
            throw new AccessDeniedException("You do not have permission for action " + action);
        }
        if (transition.reasonRequired() && (reason == null || reason.isBlank())) {
            throw new InvalidRequestException("A reason is required for " + action);
        }
        return transition;
    }
}
