package com.landnexus.shared.security;

import com.landnexus.shared.logging.LogSanitizer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** Writes the standard ApiError JSON for 401/403 raised by the security filter chain (before any controller). */
@Component
public class SecurityErrorHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(SecurityErrorHandlers.class);

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException exception) throws IOException {
        // Only the exception type is recorded: a JWT or header value must never reach the logs.
        log.warn("Authentication rejected for {} {} ({})", request.getMethod(),
                LogSanitizer.path(request.getRequestURI()), exception.getClass().getSimpleName());
        response.setHeader("WWW-Authenticate", "Bearer");
        write(request, response, 401, "Unauthorized", "Authentication is required or the token is invalid or expired");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException exception) throws IOException {
        log.warn("Access denied for {} {} ({})", request.getMethod(),
                LogSanitizer.path(request.getRequestURI()), exception.getClass().getSimpleName());
        write(request, response, 403, "Forbidden", "You do not have permission to perform this action");
    }

    private static void write(HttpServletRequest request, HttpServletResponse response,
                              int status, String error, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        String body = "{\"timestamp\":\"" + Instant.now() + "\",\"status\":" + status
                + ",\"error\":\"" + error + "\",\"message\":\"" + message
                + "\",\"path\":\"" + escape(request.getRequestURI()) + "\",\"fieldErrors\":[]}";
        response.getWriter().write(body);
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
