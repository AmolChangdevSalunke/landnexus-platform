package com.landnexus.shared.notification;

import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Every signed-in user can read and mark only their own notifications. */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public PageResponse<NotificationResponse> list(Authentication authentication,
                                                   @RequestParam(defaultValue = "false") boolean unreadOnly,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return service.list(CurrentActor.from(authentication).userId(), unreadOnly, page, size);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(Authentication authentication) {
        return Map.of("unread", service.unreadCount(CurrentActor.from(authentication).userId()));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{id}/read")
    public NotificationResponse markRead(Authentication authentication, @PathVariable UUID id) {
        return service.markRead(CurrentActor.from(authentication).userId(), id);
    }
}
