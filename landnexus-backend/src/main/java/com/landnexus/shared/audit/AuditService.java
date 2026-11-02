package com.landnexus.shared.audit;

import java.time.Clock;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes audit events inside the caller's transaction, so a change and its audit record are saved together
 * or not at all. Never put secrets (passwords, tokens) into the details text.
 */
@Service
public class AuditService {

    static final int MAX_DETAILS = 2000;
    static final String SYSTEM = "system";

    private final AuditEventRepository repository;
    private final Clock clock;

    public AuditService(AuditEventRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /** Records an event for the currently authenticated caller (or "system" when there is none). */
    @Transactional
    public void record(String action, String entityType, UUID entityId, String details) {
        UUID actorId = null;
        String actorName = SYSTEM;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token) {
            String username = token.getToken().getClaimAsString("username");
            if (username != null && !username.isBlank()) {
                actorName = username;
            }
            actorId = parseUuid(token.getToken().getSubject());
        }
        save(actorId, actorName, action, entityType, entityId, details);
    }

    /** Records an event on behalf of a named actor (used when nobody is authenticated yet, e.g. security events). */
    @Transactional
    public void recordAs(UUID actorUserId, String actorUsername, String action,
                         String entityType, UUID entityId, String details) {
        save(actorUserId, actorUsername, action, entityType, entityId, details);
    }

    private void save(UUID actorId, String actorName, String action, String entityType, UUID entityId, String details) {
        String safeDetails = details == null ? null
                : (details.length() > MAX_DETAILS ? details.substring(0, MAX_DETAILS) : details);
        repository.save(new AuditEvent(clock.instant(), actorId, actorName, action, entityType, entityId, safeDetails));
    }

    private static UUID parseUuid(String value) {
        try {
            return value == null ? null : UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
