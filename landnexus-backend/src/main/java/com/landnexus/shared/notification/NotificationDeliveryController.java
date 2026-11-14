package com.landnexus.shared.notification;

import com.landnexus.shared.pagination.PageResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Administrator review of e-mail/SMS delivery records. These endpoints are not part of the
 * ordinary user inbox; only roles with SETTINGS_MANAGE (super/central administrators) can use them.
 */
@RestController
@RequestMapping("/api/v1/notifications/deliveries")
public class NotificationDeliveryController {

    private final NotificationDeliveryService service;

    public NotificationDeliveryController(NotificationDeliveryService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @GetMapping
    public PageResponse<NotificationDeliveryResponse> list(@RequestParam(required = false) DeliveryStatus status,
                                                           @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "20") int size) {
        return service.list(status, page, size);
    }

    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @GetMapping("/by-notification/{notificationId}")
    public List<NotificationDeliveryResponse> forNotification(@PathVariable UUID notificationId) {
        return service.forNotification(notificationId);
    }

    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @PostMapping("/{id}/retry")
    public NotificationDeliveryResponse retry(@PathVariable UUID id) {
        return service.retry(id);
    }
}
