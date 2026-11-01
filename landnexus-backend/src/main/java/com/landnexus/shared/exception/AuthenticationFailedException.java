package com.landnexus.shared.exception;

/** Thrown when login or token refresh fails (maps to HTTP 401). The message never says which part was wrong. */
public class AuthenticationFailedException extends RuntimeException {
    public AuthenticationFailedException(String message) {
        super(message);
    }
}
