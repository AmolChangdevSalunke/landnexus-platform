package com.landnexus.shared.ratelimit;

import java.time.Clock;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RateLimitConfig {

    /** Runs before the Spring Security chain (which is at order -100), so a flood never reaches authentication. */
    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilter(Clock clock,
                                                                   @Value("${landnexus.ratelimit.enabled:true}") boolean enabled,
                                                                   @Value("${landnexus.ratelimit.auth-failures:10}") int authFailures,
                                                                   @Value("${landnexus.ratelimit.auth-window-seconds:900}") long authWindowSeconds,
                                                                   @Value("${landnexus.ratelimit.api-per-minute:1200}") int apiPerMinute,
                                                                   @Value("${landnexus.ratelimit.trust-forwarded-for:false}") boolean trustForwardedFor,
                                                                   @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173}") String origins) {
        Set<String> allowed = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
        RateLimitFilter.Settings settings = new RateLimitFilter.Settings(enabled, authFailures, authWindowSeconds * 1000, apiPerMinute,
                trustForwardedFor, allowed);
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(new RateLimitFilter(settings, clock));
        registration.addUrlPatterns("/api/*");
        registration.setOrder(-200);
        return registration;
    }
}