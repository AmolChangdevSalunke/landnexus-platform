package com.landnexus.shared.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.audit.AuditService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class NotificationDeliveryServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-14T09:00:00Z");
    private static final UUID DELIVERY_ID = UUID.randomUUID();

    @Mock private NotificationDeliveryRepository deliveries;
    @Mock private AuditService audit;

    private NotificationDeliveryService service;

    @BeforeEach
    void setUp() {
        service = new NotificationDeliveryService(deliveries, audit, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void list_returnsDeliveryRecordsForAdministrators() {
        NotificationDelivery delivery = delivery();
        when(deliveries.findAll(any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(delivery)));

        var page = service.list(null, 0, 20);

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().get(0).channel()).isEqualTo("EMAIL");
        assertThat(page.content().get(0).destinationMasked()).isEqualTo("j***e@example.com");
    }

    @Test
    void retry_requeuesAFailedDeliveryWithAFreshBudget() {
        NotificationDelivery delivery = delivery();
        delivery.markFailed(NOW.minusSeconds(60), "provider returned HTTP 500", 1000, 10_000);
        delivery.markFailed(NOW.minusSeconds(50), "provider returned HTTP 500", 1000, 10_000);
        delivery.markFailed(NOW.minusSeconds(40), "provider returned HTTP 500", 1000, 10_000);
        when(deliveries.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        NotificationDeliveryResponse response = service.retry(DELIVERY_ID);

        assertThat(response.status()).isEqualTo("RETRY");
        assertThat(response.attempts()).isZero();
        assertThat(response.nextAttemptAt()).isEqualTo(NOW);
        verify(audit).record(eq("NOTIFICATION_DELIVERY_REQUEUED"), eq("NotificationDelivery"),
                eq(DELIVERY_ID), any());
    }

    @Test
    void retry_aSentDelivery_isRejected() {
        NotificationDelivery delivery = delivery();
        delivery.markSent(NOW.minusSeconds(10), "log");
        when(deliveries.findById(DELIVERY_ID)).thenReturn(Optional.of(delivery));

        assertThatThrownBy(() -> service.retry(DELIVERY_ID)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void retry_anUnknownDelivery_isNotFound() {
        when(deliveries.findById(DELIVERY_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.retry(DELIVERY_ID)).isInstanceOf(ResourceNotFoundException.class);
    }

    private NotificationDelivery delivery() {
        NotificationDelivery delivery = new NotificationDelivery(UUID.randomUUID(), UUID.randomUUID(),
                NotificationChannel.EMAIL, "j***e@example.com", 3,
                UUID.randomUUID() + ":EMAIL", NOW);
        ReflectionTestUtils.setField(delivery, "id", DELIVERY_ID);
        return delivery;
    }
}
