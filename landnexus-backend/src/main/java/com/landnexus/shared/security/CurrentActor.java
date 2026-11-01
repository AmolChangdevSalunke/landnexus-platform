package com.landnexus.shared.security;

import com.landnexus.shared.exception.AuthenticationFailedException;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** The authenticated caller, read from the verified JWT. Used for business rules such as "who may grant SUPER_ADMIN". */
public record CurrentActor(UUID userId, String username, Set<String> roles) {

    private static final String ROLE_PREFIX = "ROLE_";

    public static CurrentActor from(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token)) {
            throw new AuthenticationFailedException("Authentication is required");
        }
        Jwt jwt = token.getToken();
        Set<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith(ROLE_PREFIX))
                .map(a -> a.substring(ROLE_PREFIX.length()))
                .collect(Collectors.toUnmodifiableSet());
        return new CurrentActor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("username"), roles);
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
