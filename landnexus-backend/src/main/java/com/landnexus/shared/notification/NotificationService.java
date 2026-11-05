package com.landnexus.shared.notification;

import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import java.time.Clock;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** In-app notifications. A user can only ever see and mark their own. */
@Service
@Transactional(readOnly = true)
public class NotificationService {

    private static final int MAX_TITLE = 200;
    private static final int MAX_MESSAGE = 1000;

    private final NotificationRepository repository;
    private final Clock clock;

    public NotificationService(NotificationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    public void notify(UUID recipientUserId, String type, String title, String message,
                       String entityType, UUID entityId) {
        repository.save(new Notification(recipientUserId, type, cut(title, MAX_TITLE), cut(message, MAX_MESSAGE),
                entityType, entityId, clock.instant()));
    }

    public PageResponse<NotificationResponse> list(UUID recipientUserId, boolean unreadOnly, int page, int size) {
        Pageable pageable = PageParams.ofDescending(page, size, "createdAt");
        Page<Notification> result = unreadOnly
                ? repository.findByRecipientUserIdAndReadAtIsNull(recipientUserId, pageable)
                : repository.findByRecipientUserId(recipientUserId, pageable);
        return PageResponse.from(result, NotificationResponse::from);
    }

    public long unreadCount(UUID recipientUserId) {
        return repository.countByRecipientUserIdAndReadAtIsNull(recipientUserId);
    }

    @Transactional
    public NotificationResponse markRead(UUID recipientUserId, UUID id) {
        Notification notification = repository.findByIdAndRecipientUserId(id, recipientUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id));
        if (notification.getReadAt() == null) {
            notification.setReadAt(clock.instant());
        }
        return NotificationResponse.from(notification);
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }
}
