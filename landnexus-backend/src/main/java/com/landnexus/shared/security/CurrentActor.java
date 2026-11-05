package com.landnexus.shared.security;

import com.landnexus.shared.exception.AuthenticationFailedException;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * The authenticated caller, read from the verified JWT: id, username, role codes (without the ROLE_ prefix)
 * and every authority (permission codes plus ROLE_x).
 */
public record CurrentActor(UUID userId, String username, Set<String> roles, Set<String> authorities) {

    private static final String ROLE_PREFIX = "ROLE_";

    /** Convenience for code that only cares about roles (authorities stay empty). */
    public CurrentActor(UUID userId, String username, Set<String> roles) {
        this(userId, username, roles, Set.of());
    }

    public static CurrentActor from(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token)) {
            throw new AuthenticationFailedException("Authentication is required");
        }
        Jwt jwt = token.getToken();
        Set<String> all = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toUnmodifiableSet());
        Set<String> roles = all.stream()
                .filter(a -> a.startsWith(ROLE_PREFIX))
                .map(a -> a.substring(ROLE_PREFIX.length()))
                .collect(Collectors.toUnmodifiableSet());
        return new CurrentActor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("username"), roles, all);
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }

    public boolean hasAuthority(String authority) {
        return authorities.contains(authority);
    }
}
