package com.landnexus.shared.exception;

/** Thrown when a requested record does not exist (maps to HTTP 404). */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}