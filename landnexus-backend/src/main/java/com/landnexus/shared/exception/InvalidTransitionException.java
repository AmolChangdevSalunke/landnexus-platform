package com.landnexus.shared.exception;

/** Thrown when an action is not allowed in the record's current state (maps to HTTP 409). */
public class InvalidTransitionException extends RuntimeException {
    public InvalidTransitionException(String message) {
        super(message);
    }
}
