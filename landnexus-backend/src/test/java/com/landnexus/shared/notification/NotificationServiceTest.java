package com.landnexus.shared.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.shared.exception.ResourceNotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-03T10:00:00Z");

    @Mock private NotificationRepository repository;
    @Mock private NotificationOutbox outbox;

    private NotificationService service;
    private final UUID me = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new NotificationService(repository, outbox, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void notify_savesAnUnreadNotification_andTrimsLongText() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.notify(me, "PROPOSAL", "t".repeat(500), "m".repeat(5000), "Proposal", UUID.randomUUID());

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getRecipientUserId()).isEqualTo(me);
        assertThat(saved.getValue().getReadAt()).isNull();
        assertThat(saved.getValue().getCreatedAt()).isEqualTo(NOW);
        assertThat(saved.getValue().getTitle()).hasSize(200);
        assertThat(saved.getValue().getMessage()).hasSize(1000);
        verify(outbox).enqueue(saved.getValue());
    }

    @Test
    void notify_whenTheOutboxFails_propagatesSoTheBusinessTransactionRollsBack() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new IllegalStateException("outbox unavailable")).when(outbox).enqueue(any());

        assertThatThrownBy(() -> service.notify(me, "PROPOSAL", "title", "message", "Proposal", UUID.randomUUID()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("outbox unavailable");
    }

    @Test
    void markRead_ownNotification_setsReadAt() {
        UUID id = UUID.randomUUID();
        Notification n = new Notification(me, "T", "title", "msg", null, null, NOW);
        when(repository.findByIdAndRecipientUserId(id, me)).thenReturn(Optional.of(n));

        NotificationResponse response = service.markRead(me, id);

        assertThat(response.read()).isTrue();
        assertThat(n.getReadAt()).isEqualTo(NOW);
    }

    @Test
    void markRead_someoneElsesNotification_isNotFound() {
        UUID id = UUID.randomUUID();
        when(repository.findByIdAndRecipientUserId(id, me)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead(me, id)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void unreadCount_delegatesToTheRepository() {
        when(repository.countByRecipientUserIdAndReadAtIsNull(me)).thenReturn(3L);

        assertThat(service.unreadCount(me)).isEqualTo(3L);
    }

    @Test
    void list_unreadOnly_usesTheUnreadQuery() {
        when(repository.findByRecipientUserIdAndReadAtIsNull(any(), any())).thenReturn(org.springframework.data.domain.Page.empty());

        assertThat(service.list(me, true, 0, 20).content()).isEmpty();
    }
}
