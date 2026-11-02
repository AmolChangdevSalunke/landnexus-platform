package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.api.dto.AuditEventResponse;
import com.landnexus.administration.api.dto.LoginHistoryResponse;
import com.landnexus.administration.domain.LoginHistory;
import com.landnexus.administration.infrastructure.LoginHistoryRepository;
import com.landnexus.shared.audit.AuditEvent;
import com.landnexus.shared.audit.AuditEventRepository;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.ClientInfo;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

@ExtendWith(MockitoExtension.class)
class AuditQueryServiceTest {

    @Mock private AuditEventRepository auditEvents;
    @Mock private LoginHistoryRepository loginHistory;

    private AuditQueryService service;

    @BeforeEach
    void setUp() {
        service = new AuditQueryService(auditEvents, loginHistory);
    }

    @Test
    void entityIdWithoutEntityType_isRejected() {
        assertThatThrownBy(() -> service.searchAudit(null, UUID.randomUUID(), null, 0, 20))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void searchAudit_returnsNewestFirstPage_withCappedSize() {
        AuditEvent event = new AuditEvent(Instant.parse("2026-11-01T10:00:00Z"), null, "alice", "CREATE", "State", null, "x");
        when(auditEvents.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(event)));

        PageResponse<AuditEventResponse> page = service.searchAudit("State", null, "alice", 0, 500);

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().get(0).actorUsername()).isEqualTo("alice");
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(auditEvents).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
        assertThat(pageable.getValue().getSort().getOrderFor("occurredAt").isDescending()).isTrue();
    }

    @Test
    void searchLogins_withUsername_filtersByNormalizedName() {
        LoginHistory row = LoginHistory.failure(null, "alice", "BAD_PASSWORD", ClientInfo.unknown(), Instant.now());
        when(loginHistory.findByUsernameAttempted(eq("alice"), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(row)));

        PageResponse<LoginHistoryResponse> page = service.searchLogins("  Alice ", 0, 20);

        assertThat(page.content()).hasSize(1);
    }

    @Test
    void searchLogins_withoutUsername_listsEverything() {
        when(loginHistory.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        assertThat(service.searchLogins(null, 0, 20).content()).isEmpty();
    }
}
