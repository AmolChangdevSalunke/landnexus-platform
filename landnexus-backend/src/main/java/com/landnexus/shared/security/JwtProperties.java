package com.landnexus.shared.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** JWT settings. The secret comes from the JWT_SECRET environment variable, never from source code. */
@ConfigurationProperties(prefix = "landnexus.jwt")
public record JwtProperties(String secret, String issuer, long accessTokenMinutes, long refreshTokenDays) {

    public JwtProperties {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT secret is missing or too short: set the JWT_SECRET environment variable (at least 32 characters)");
        }
        if (issuer == null || issuer.isBlank()) {
            throw new IllegalStateException("landnexus.jwt.issuer must not be blank");
        }
        if (accessTokenMinutes <= 0 || refreshTokenDays <= 0) {
            throw new IllegalStateException("Token lifetimes must be positive");
        }
    }
}
