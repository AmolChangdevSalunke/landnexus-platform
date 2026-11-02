package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.AuditEventResponse;
import com.landnexus.administration.api.dto.LoginHistoryResponse;
import com.landnexus.administration.application.AuditQueryService;
import com.landnexus.shared.pagination.PageResponse;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only. Nothing in the API can change or delete audit data. */
@RestController
@RequestMapping("/api/v1/administration")
public class AuditController {

    private final AuditQueryService service;

    public AuditController(AuditQueryService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('AUDIT_READ')")
    @GetMapping("/audit-events")
    public PageResponse<AuditEventResponse> auditEvents(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) String actor,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.searchAudit(entityType, entityId, actor, page, size);
    }

    @PreAuthorize("hasAuthority('AUDIT_READ')")
    @GetMapping("/login-history")
    public PageResponse<LoginHistoryResponse> loginHistory(
            @RequestParam(required = false) String username,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.searchLogins(username, page, size);
    }
}
