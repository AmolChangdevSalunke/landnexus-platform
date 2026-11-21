package com.landnexus.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestLoggingFilterTest {

    private final RequestLoggingFilter filter = new RequestLoggingFilter();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void addsCorrelationIdResponseHeaderAndClearsMdc() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> {
            assertThat(MDC.get(RequestLoggingFilter.REQUEST_ID)).startsWith("req-");
            assertThat(MDC.get("method")).isEqualTo("GET");
            assertThat(MDC.get("path")).isEqualTo("/api/v1/projects");
            ((MockHttpServletResponse) res).setStatus(200);
        };

        filter.doFilter(request, response, chain);

        assertThat(response.getHeader(RequestLoggingFilter.REQUEST_ID_HEADER)).startsWith("req-");
        assertThat(MDC.get(RequestLoggingFilter.REQUEST_ID)).isNull();
        assertThat(MDC.get(RequestLoggingFilter.USER_ID)).isNull();
    }

    @Test
    void reusesSafeClientRequestIdAndRejectsUnsafeValues() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader(RequestLoggingFilter.REQUEST_ID_HEADER, "req-client-123456");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> ((MockHttpServletResponse) res).setStatus(204));

        assertThat(response.getHeader(RequestLoggingFilter.REQUEST_ID_HEADER)).isEqualTo("req-client-123456");

        MockHttpServletRequest forged = new MockHttpServletRequest("GET", "/api/v1/projects");
        forged.addHeader(RequestLoggingFilter.REQUEST_ID_HEADER, "bad\r\nINFO forged");
        MockHttpServletResponse forgedResponse = new MockHttpServletResponse();

        filter.doFilter(forged, forgedResponse, (req, res) -> ((MockHttpServletResponse) res).setStatus(204));

        assertThat(forgedResponse.getHeader(RequestLoggingFilter.REQUEST_ID_HEADER))
                .startsWith("req-").doesNotContain("\r", "\n");
    }

    @Test
    void recordsErrorStatusWithoutThrowing() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> ((MockHttpServletResponse) res).setStatus(500));

        assertThat(response.getStatus()).isEqualTo(500);
        assertThat(MDC.get(RequestLoggingFilter.REQUEST_ID)).isNull();
    }
}
