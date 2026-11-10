package com.landnexus.administration.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/** The only public password endpoint. It has its own chain so the main security configuration stays untouched. */
@Configuration
public class PublicEndpointsConfig {

    @Bean
    @Order(1)
    SecurityFilterChain publicPasswordResetChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/api/v1/auth/reset-password")
                .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }
}