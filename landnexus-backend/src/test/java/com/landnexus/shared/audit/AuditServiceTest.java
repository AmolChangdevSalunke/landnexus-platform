package com.landnexus.shared.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-01T10:00:00Z");

    @Mock private AuditEventRepository repository;

    private AuditService service;

    @BeforeEach
    void setUp() {
        service = new AuditService(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private AuditEvent saved() {
        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void record_usesTheLoggedInUserAsActor() {
        UUID actorId = UUID.randomUUID();
        Jwt jwt = Jwt.withTokenValue("t").header("alg", "HS256")
                .subject(actorId.toString()).claim("username", "alice")
                .issuedAt(NOW).expiresAt(NOW.plusSeconds(900)).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
        UUID entityId = UUID.randomUUID();

        service.record("CREATE", "State", entityId, "code=MH");

        AuditEvent event = saved();
        assertThat(event.getActorUsername()).isEqualTo("alice");
        assertThat(event.getActorUserId()).isEqualTo(actorId);
        assertThat(event.getAction()).isEqualTo("CREATE");
        assertThat(event.getEntityType()).isEqualTo("State");
        assertThat(event.getEntityId()).isEqualTo(entityId);
        assertThat(event.getDetails()).isEqualTo("code=MH");
        assertThat(event.getOccurredAt()).isEqualTo(NOW);
    }

    @Test
    void record_withoutAuthentication_usesSystem() {
        service.record("CREATE", "State", null, "x");

        AuditEvent event = saved();
        assertThat(event.getActorUsername()).isEqualTo("system");
        assertThat(event.getActorUserId()).isNull();
    }

    @Test
    void record_withNonUuidSubject_stillWorks() {
        Jwt jwt = Jwt.withTokenValue("t").header("alg", "HS256")
                .subject("not-a-uuid").claim("username", "bob")
                .issuedAt(NOW).expiresAt(NOW.plusSeconds(900)).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));

        service.record("UPDATE", "State", null, "x");

        AuditEvent event = saved();
        assertThat(event.getActorUsername()).isEqualTo("bob");
        assertThat(event.getActorUserId()).isNull();
    }

    @Test
    void recordAs_usesTheGivenActor() {
        UUID actorId = UUID.randomUUID();

        service.recordAs(actorId, "carol", "ACCOUNT_LOCKED", "UserAccount", actorId, "locked");

        AuditEvent event = saved();
        assertThat(event.getActorUsername()).isEqualTo("carol");
        assertThat(event.getActorUserId()).isEqualTo(actorId);
    }

    @Test
    void veryLongDetails_areTruncated() {
        service.recordAs(null, "x", "A", "T", null, "d".repeat(5000));

        assertThat(saved().getDetails()).hasSize(AuditService.MAX_DETAILS);
    }
}
