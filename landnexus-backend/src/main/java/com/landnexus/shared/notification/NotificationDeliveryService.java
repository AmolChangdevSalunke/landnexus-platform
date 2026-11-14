package com.landnexus.shared.notification;

import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Administrative review of the external outbox: delivery records and a manual retry. */
@Service
@Transactional(readOnly = true)
public class NotificationDeliveryService {

    private final NotificationDeliveryRepository deliveries;
    private final AuditService audit;
    private final Clock clock;

    public NotificationDeliveryService(NotificationDeliveryRepository deliveries, AuditService audit, Clock clock) {
        this.deliveries = deliveries;
        this.audit = audit;
        this.clock = clock;
    }

    public PageResponse<NotificationDeliveryResponse> list(DeliveryStatus status, int page, int size) {
        Pageable pageable = PageParams.ofDescending(page, size, "createdAt");
        Page<NotificationDelivery> result = status == null
                ? deliveries.findAll(pageable)
                : deliveries.findByStatus(status, pageable);
        return PageResponse.from(result, NotificationDeliveryResponse::from);
    }

    public List<NotificationDeliveryResponse> forNotification(UUID notificationId) {
        return deliveries.findByNotificationIdOrderByCreatedAtAsc(notificationId).stream()
                .map(NotificationDeliveryResponse::from)
                .toList();
    }

    /** Puts a failed (or pending) delivery back in the queue with a fresh attempt budget. */
    @Transactional
    public NotificationDeliveryResponse retry(UUID id) {
        NotificationDelivery delivery = deliveries.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery not found: " + id));
        if (delivery.getStatus() == DeliveryStatus.SENT) {
            throw new InvalidRequestException("This delivery was already sent");
        }
        delivery.requeue(clock.instant());
        audit.record("NOTIFICATION_DELIVERY_REQUEUED", "NotificationDelivery", id,
                "channel=" + delivery.getChannel() + " to=" + delivery.getDestinationMasked());
        return NotificationDeliveryResponse.from(delivery);
    }
}
