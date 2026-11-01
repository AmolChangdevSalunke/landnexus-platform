package com.landnexus.shared.exception;

/** Thrown when a record with the same unique value already exists (maps to HTTP 409). */
public class DuplicateResourceException extends RuntimeException {
    public DuplicateResourceException(String message) {
        super(message);
    }
}