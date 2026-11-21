package com.landnexus.shared.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives every HTTP request a correlation id, exposes it as {@code X-Request-Id}, and writes one line when the
 * request finishes. Exceptions are logged once by {@code ApiExceptionHandler}; this filter only records the
 * resulting status, method, path and duration so the two do not duplicate the same stack trace.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestLoggingFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String REQUEST_ID = "requestId";
    public static final String USER_ID = "userId";

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);
    private static final String METHOD = "method";
    private static final String PATH = "path";
    private static final java.util.regex.Pattern SAFE_REQUEST_ID =
            java.util.regex.Pattern.compile("[A-Za-z0-9._-]{8,80}");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = requestId(request.getHeader(REQUEST_ID_HEADER));
        String method = request.getMethod();
        String path = LogSanitizer.path(request.getRequestURI());
        MDC.put(REQUEST_ID, requestId);
        MDC.put(METHOD, method);
        MDC.put(PATH, path);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        long started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - started) / 1_000_000L;
            int status = response.getStatus();
            String message = "HTTP " + method + " " + path + " -> " + status + " (" + durationMs + " ms)";
            if (status >= 500) {
                log.error(message);
            } else if (status >= 400) {
                log.warn(message);
            } else if (isProbe(path)) {
                log.debug(message);
            } else {
                log.info(message);
            }
            MDC.remove(REQUEST_ID);
            MDC.remove(METHOD);
            MDC.remove(PATH);
            MDC.remove(USER_ID);
        }
    }

    /** Accepts a caller-supplied id only when it is short and contains no characters that could forge a log line. */
    static String requestId(String supplied) {
        if (supplied != null && SAFE_REQUEST_ID.matcher(supplied).matches()) {
            return supplied;
        }
        return "req-" + UUID.randomUUID();
    }

    private static boolean isProbe(String path) {
        return path.startsWith("/actuator/health") || path.startsWith("/actuator/info");
    }
}
