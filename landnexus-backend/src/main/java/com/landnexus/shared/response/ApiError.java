package com.landnexus.shared.response;

import java.time.Instant;
import java.util.List;

/** Standard error body returned by every API endpoint. */
public record ApiError(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        List<FieldIssue> fieldErrors) {

    public record FieldIssue(String field, String message) {}
}