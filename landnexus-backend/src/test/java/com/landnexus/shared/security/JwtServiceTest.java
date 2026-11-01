package com.landnexus.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class JwtServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    private final SecurityConfig config = new SecurityConfig();
    private final JwtProperties properties = new JwtProperties(SECRET, "landnexus", 15, 7);
    private final JwtService jwtService = new JwtService(config.jwtEncoder(properties), properties);
    private final JwtDecoder decoder = config.jwtDecoder(properties);

    @Test
    void issuedToken_roundTripsWithClaims() {
        UUID userId = UUID.randomUUID();
        String token = jwtService.createAccessToken(userId, "alice", List.of("ROLE_AUDITOR", "MASTER_DATA_READ"), Instant.now());

        Jwt jwt = decoder.decode(token);

        assertThat(jwt.getSubject()).isEqualTo(userId.toString());
        assertThat(jwt.getClaimAsString("username")).isEqualTo("alice");
        assertThat(jwt.getClaimAsStringList("authorities")).containsExactlyInAnyOrder("ROLE_AUDITOR", "MASTER_DATA_READ");
        assertThat(jwt.getClaim("iss").toString()).isEqualTo("landnexus");
    }

    @Test
    void expiredToken_isRejected() {
        String token = jwtService.createAccessToken(UUID.randomUUID(), "alice", List.of("X"),
                Instant.now().minus(Duration.ofHours(2)));

        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void tokenSignedWithAnotherSecret_isRejected() {
        JwtProperties other = new JwtProperties("ffffffffffffffffffffffffffffffff", "landnexus", 15, 7);
        JwtService otherService = new JwtService(config.jwtEncoder(other), other);
        String forged = otherService.createAccessToken(UUID.randomUUID(), "mallory", List.of("ROLE_SUPER_ADMIN"), Instant.now());

        assertThatThrownBy(() -> decoder.decode(forged)).isInstanceOf(JwtException.class);
    }

    @Test
    void tokenFromAnotherIssuer_isRejected() {
        JwtProperties other = new JwtProperties(SECRET, "someone-else", 15, 7);
        JwtService otherService = new JwtService(config.jwtEncoder(other), other);
        String token = otherService.createAccessToken(UUID.randomUUID(), "alice", List.of("X"), Instant.now());

        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void shortSecret_isRefusedAtStartup() {
        assertThatThrownBy(() -> new JwtProperties("too-short", "landnexus", 15, 7))
                .isInstanceOf(IllegalStateException.class);
    }
}
