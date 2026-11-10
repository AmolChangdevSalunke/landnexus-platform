package com.landnexus.shared.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

    /** A clock the test can move. */
    static final class TestClock extends Clock {
        long now = 1_000_000L;

        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(now); }
    }

    private final TestClock clock = new TestClock();
    private final AtomicInteger reached = new AtomicInteger();

    private RateLimitFilter filter(boolean enabled, int failures, int perMinute, boolean trustXff) {
        return new RateLimitFilter(new RateLimitFilter.Settings(enabled, failures, 900_000, perMinute, trustXff, Set.of("http://localhost:5173")), clock);
    }

    private MockHttpServletResponse call(RateLimitFilter f, String path, String ip, int downstreamStatus) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr(ip);
        request.addHeader("Origin", "http://localhost:5173");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain(new jakarta.servlet.http.HttpServlet() {
            @Override protected void service(jakarta.servlet.http.HttpServletRequest req, HttpServletResponse res) {
                reached.incrementAndGet();
                res.setStatus(downstreamStatus);
            }
        });
        f.doFilter(request, response, chain);
        return response;
    }

    @Test
    void failedLogins_areBlockedAfterTheLimit_withRetryAfterAndCorsHeaders() throws Exception {
        RateLimitFilter f = filter(true, 3, 1000, false);
        for (int i = 0; i < 3; i++) {
            assertThat(call(f, "/api/v1/auth/login", "10.0.0.1", 401).getStatus()).isEqualTo(401);
        }
        MockHttpServletResponse blocked = call(f, "/api/v1/auth/login", "10.0.0.1", 401);

        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isNotBlank();
        assertThat(blocked.getHeader("Access-Control-Allow-Origin")).isEqualTo("http://localhost:5173");
        assertThat(blocked.getContentAsString()).contains("\"status\":429").contains("Too many attempts");
        assertThat(reached.get()).isEqualTo(3);
        assertThat(call(f, "/api/v1/auth/login", "10.0.0.2", 401).getStatus()).isEqualTo(401);   // another client is not affected
    }

    @Test
    void successfulLogins_neverCount_andTheBlockEndsWhenTheWindowPasses() throws Exception {
        RateLimitFilter f = filter(true, 2, 1000, false);
        for (int i = 0; i < 50; i++) {
            assertThat(call(f, "/api/v1/auth/login", "10.0.0.1", 200).getStatus()).isEqualTo(200);
        }
        call(f, "/api/v1/auth/login", "10.0.0.1", 401);
        call(f, "/api/v1/auth/login", "10.0.0.1", 401);
        assertThat(call(f, "/api/v1/auth/login", "10.0.0.1", 200).getStatus()).isEqualTo(429);
        clock.now += 901_000;
        assertThat(call(f, "/api/v1/auth/login", "10.0.0.1", 200).getStatus()).isEqualTo(200);
    }

    @Test
    void otherPathsAreNotTreatedAsLogins_andNonApiPathsAreIgnored() throws Exception {
        RateLimitFilter f = filter(true, 1, 1000, false);
        for (int i = 0; i < 5; i++) {
            assertThat(call(f, "/api/v1/land-records/parcels", "10.0.0.1", 403).getStatus()).isEqualTo(403);
            assertThat(call(f, "/actuator/health", "10.0.0.1", 401).getStatus()).isEqualTo(401);
        }
    }

    @Test
    void aFloodOfRequests_isLimitedPerMinute_thenAllowedAgain() throws Exception {
        RateLimitFilter f = filter(true, 10, 5, false);
        for (int i = 0; i < 5; i++) {
            assertThat(call(f, "/api/v1/projects", "10.0.0.1", 200).getStatus()).isEqualTo(200);
        }
        assertThat(call(f, "/api/v1/projects", "10.0.0.1", 200).getStatus()).isEqualTo(429);
        clock.now += 61_000;
        assertThat(call(f, "/api/v1/projects", "10.0.0.1", 200).getStatus()).isEqualTo(200);
    }

    @Test
    void whenDisabled_nothingIsLimited() throws Exception {
        RateLimitFilter f = filter(false, 1, 1, false);
        for (int i = 0; i < 10; i++) {
            assertThat(call(f, "/api/v1/auth/login", "10.0.0.1", 401).getStatus()).isEqualTo(401);
        }
    }

    @Test
    void forwardedFor_isTrustedOnlyWhenConfigured() throws Exception {
        RateLimitFilter trusting = filter(true, 1, 1000, true);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr("10.9.9.9");
        request.addHeader("X-Forwarded-For", "203.0.113.5, 10.9.9.9");
        MockFilterChain chain = new MockFilterChain(new jakarta.servlet.http.HttpServlet() {
            @Override protected void service(jakarta.servlet.http.HttpServletRequest req, HttpServletResponse res) { res.setStatus(401); }
        });
        trusting.doFilter(request, new MockHttpServletResponse(), chain);

        // the failure was recorded for 203.0.113.5, not for the proxy address
        assertThat(call(trusting, "/api/v1/auth/login", "10.9.9.9", 200).getStatus()).isEqualTo(200);
        MockHttpServletRequest again = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        again.setRemoteAddr("10.9.9.9");
        again.addHeader("X-Forwarded-For", "203.0.113.5");
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        trusting.doFilter(again, blocked, chain);
        assertThat(blocked.getStatus()).isEqualTo(429);
    }
}