package com.landnexus.shared.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Two limits per client address: (1) every API request (protection against floods) and (2) failed requests to the
 * sign-in style endpoints (protection against password guessing). Successful logins are never counted. The 429 answer
 * carries Retry-After and, for an allowed origin, the CORS headers, so the browser app can read it.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    public record Settings(boolean enabled, int authFailures, long authWindowMs, int apiPerMinute, boolean trustForwardedFor,
                           Set<String> allowedOrigins) {
    }

    static final Set<String> AUTH_PATHS = Set.of("/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/reset-password",
            "/api/v1/auth/change-password");

    private final Settings settings;
    private final Clock clock;
    private final SlidingWindowCounter requests = new SlidingWindowCounter(100_000, 60_000);
    private final SlidingWindowCounter failures;

    public RateLimitFilter(Settings settings, Clock clock) {
        this.settings = settings;
        this.clock = clock;
        this.failures = new SlidingWindowCounter(100_000, settings.authWindowMs());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!settings.enabled() || !path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }
        long now = clock.millis();
        String client = clientOf(request);
        requests.add(client, now);
        if (requests.count(client, now, 60_000) > settings.apiPerMinute()) {
            reject(request, response, requests.retryAfterMs(client, now, 60_000));
            return;
        }
        boolean auth = AUTH_PATHS.contains(path);
        if (auth && failures.count(client, now, settings.authWindowMs()) >= settings.authFailures()) {
            reject(request, response, failures.retryAfterMs(client, now, settings.authWindowMs()));
            return;
        }
        chain.doFilter(request, response);
        int status = response.getStatus();
        if (auth && status >= 400 && status < 500 && status != 429) {
            failures.add(client, clock.millis());
        }
    }

    private String clientOf(HttpServletRequest request) {
        if (settings.trustForwardedFor()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String first = forwarded.split(",")[0].trim();
                return first.length() > 64 ? first.substring(0, 64) : first;
            }
        }
        return request.getRemoteAddr();
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, long retryAfterMs) throws IOException {
        long seconds = Math.max(1, (retryAfterMs + 999) / 1000);
        response.setStatus(429);
        response.setHeader("Retry-After", Long.toString(seconds));
        String origin = request.getHeader("Origin");
        if (origin != null && settings.allowedOrigins().contains(origin)) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Vary", "Origin");
            response.setHeader("Access-Control-Expose-Headers", "Retry-After");
        }
        response.setContentType("application/json;charset=UTF-8");
        String path = request.getRequestURI().replaceAll("[\"\\\\]", "");
        String body = "{\"timestamp\":\"" + Instant.now(clock) + "\",\"status\":429,\"error\":\"Too Many Requests\","
                + "\"message\":\"Too many attempts. Try again in " + seconds + " seconds.\",\"path\":\"" + path + "\",\"fieldErrors\":[]}";
        response.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
    }
}