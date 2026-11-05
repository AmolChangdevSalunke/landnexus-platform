package com.landnexus.shared.workflow;

/** One allowed move: from a state, by a named action, to another state, needing one authority. */
public record Transition<S extends Enum<S>>(S from, String action, S to, String requiredAuthority, boolean reasonRequired) {
}
