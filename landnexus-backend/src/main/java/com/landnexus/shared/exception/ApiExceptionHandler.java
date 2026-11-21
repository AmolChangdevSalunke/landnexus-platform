package com.landnexus.shared.exception;

import com.landnexus.shared.logging.LogSanitizer;
import com.landnexus.shared.response.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Converts exceptions into consistent ApiError responses and writes one operational log line per failure.
 * Responses never contain internal details; logs carry the context and stack trace. The request logging filter
 * only adds the HTTP status, so an exception is not logged twice.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest req) {
        log.debug("Resource not found: {} {} ({})", req.getMethod(), path(req), LogSanitizer.safe(ex.getMessage()));
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiError> handleDuplicate(DuplicateResourceException ex, HttpServletRequest req) {
        log.warn("Duplicate resource on {} {}: {}", req.getMethod(), path(req), LogSanitizer.safe(ex.getMessage()));
        return build(HttpStatus.CONFLICT, ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ApiError> handleInvalidRequest(InvalidRequestException ex, HttpServletRequest req) {
        log.warn("Rejected request on {} {}: {}", req.getMethod(), path(req), LogSanitizer.safe(ex.getMessage()));
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(AuthenticationFailedException.class)
    public ResponseEntity<ApiError> handleAuthenticationFailed(AuthenticationFailedException ex, HttpServletRequest req) {
        log.warn("Authentication failed on {} {}: {}", req.getMethod(), path(req), LogSanitizer.safe(ex.getMessage()));
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage(), req, List.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthentication(AuthenticationException ex, HttpServletRequest req) {
        log.warn("Authentication required on {} {} ({})", req.getMethod(), path(req), ex.getClass().getSimpleName());
        return build(HttpStatus.UNAUTHORIZED, "Authentication is required", req, List.of());
    }

    /** Thrown by @PreAuthorize and by service-level rules (e.g. only a SUPER_ADMIN may grant SUPER_ADMIN). */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        log.warn("Access denied on {} {} ({})", req.getMethod(), path(req), ex.getClass().getSimpleName());
        return build(HttpStatus.FORBIDDEN, "You do not have permission to perform this action", req, List.of());
    }

    @ExceptionHandler(InvalidTransitionException.class)
    public ResponseEntity<ApiError> handleInvalidTransition(InvalidTransitionException ex, HttpServletRequest req) {
        log.warn("Invalid workflow transition on {} {}: {}", req.getMethod(), path(req), LogSanitizer.safe(ex.getMessage()));
        return build(HttpStatus.CONFLICT, ex.getMessage(), req, List.of());
    }

    /** Two people changed the same record at the same time; the second one must reload and retry. */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleOptimisticLock(ObjectOptimisticLockingFailureException ex, HttpServletRequest req) {
        log.warn("Optimistic lock conflict on {} {}: {}", req.getMethod(), path(req), ex.getClass().getSimpleName());
        return build(HttpStatus.CONFLICT, "The record was changed by someone else; reload it and try again", req, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<ApiError.FieldIssue> issues = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ApiError.FieldIssue(fe.getField(), fe.getDefaultMessage()))
                .toList();
        // Field names only: rejected values may contain personal data.
        String fields = issues.stream().map(ApiError.FieldIssue::field).distinct().collect(Collectors.joining(","));
        log.warn("Validation failed on {} {} (fields: {})", req.getMethod(), path(req), fields);
        return build(HttpStatus.BAD_REQUEST, "Validation failed", req, issues);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest req) {
        log.warn("Unreadable request body on {} {}", req.getMethod(), path(req));
        return build(HttpStatus.BAD_REQUEST, "Malformed or unreadable request body", req, List.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest req) {
        log.warn("Invalid parameter on {} {} (parameter: {})", req.getMethod(), path(req),
                LogSanitizer.safe(ex.getName()));
        return build(HttpStatus.BAD_REQUEST, "Invalid value for parameter '" + ex.getName() + "'", req, List.of());
    }

    /** Safety net: the database unique/foreign-key constraints caught something the service did not. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleIntegrity(DataIntegrityViolationException ex, HttpServletRequest req) {
        // The driver message can include column values, so record the exception type and path only.
        log.warn("Data integrity violation on {} {} ({})", req.getMethod(), path(req),
                rootCause(ex).getClass().getSimpleName());
        return build(HttpStatus.CONFLICT, "The request conflicts with existing data", req, List.of());
    }

    /** Database outages, pool exhaustion, SQL failures: unexpected server-side failures with a full stack trace. */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiError> handleDataAccess(DataAccessException ex, HttpServletRequest req) {
        log.error("Database error on {} {}", req.getMethod(), path(req), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", req, List.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest req) {
        // Spring's own web exceptions (unknown URL = 404, wrong method = 405, ...) already carry a status.
        if (ex instanceof ErrorResponse errorResponse) {
            HttpStatus status = HttpStatus.resolve(errorResponse.getStatusCode().value());
            HttpStatus safe = status != null ? status : HttpStatus.INTERNAL_SERVER_ERROR;
            if (safe.is4xxClientError()) {
                String detail = errorResponse.getBody().getDetail();
                log.debug("Client error on {} {}: {}", req.getMethod(), path(req), safe.value());
                return build(safe, detail != null ? detail : safe.getReasonPhrase(), req, List.of());
            }
        }
        log.error("Unexpected error on {} {}", req.getMethod(), path(req), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", req, List.of());
    }

    private static String path(HttpServletRequest req) {
        return LogSanitizer.path(req.getRequestURI());
    }

    private static Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String message, HttpServletRequest req,
                                           List<ApiError.FieldIssue> issues) {
        ApiError body = new ApiError(Instant.now(), status.value(), status.getReasonPhrase(),
                message, req.getRequestURI(), issues);
        return ResponseEntity.status(status).body(body);
    }
}
