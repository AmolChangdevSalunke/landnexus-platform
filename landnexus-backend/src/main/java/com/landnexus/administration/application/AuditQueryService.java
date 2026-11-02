package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.AuditEventResponse;
import com.landnexus.administration.api.dto.LoginHistoryResponse;
import com.landnexus.administration.domain.LoginHistory;
import com.landnexus.administration.infrastructure.LoginHistoryRepository;
import com.landnexus.shared.audit.AuditEvent;
import com.landnexus.shared.audit.AuditEventRepository;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.validation.TextNormalizer;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only views over the audit trail and login history, newest first. */
@Service
@Transactional(readOnly = true)
public class AuditQueryService {

    private final AuditEventRepository auditEvents;
    private final LoginHistoryRepository loginHistory;

    public AuditQueryService(AuditEventRepository auditEvents, LoginHistoryRepository loginHistory) {
        this.auditEvents = auditEvents;
        this.loginHistory = loginHistory;
    }

    public PageResponse<AuditEventResponse> searchAudit(String entityType, UUID entityId, String actor,
                                                        int page, int size) {
        if (entityId != null && (entityType == null || entityType.isBlank())) {
            throw new InvalidRequestException("entityId can only be used together with entityType");
        }
        String type = entityType == null || entityType.isBlank() ? null : entityType.trim();
        String actorName = actor == null || actor.isBlank() ? null : actor.trim();

        Specification<AuditEvent> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (type != null) {
                predicates.add(cb.equal(root.get("entityType"), type));
            }
            if (entityId != null) {
                predicates.add(cb.equal(root.get("entityId"), entityId));
            }
            if (actorName != null) {
                predicates.add(cb.equal(root.get("actorUsername"), actorName));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<AuditEvent> result = auditEvents.findAll(spec, PageParams.ofDescending(page, size, "occurredAt"));
        return PageResponse.from(result, AuditEventResponse::from);
    }

    public PageResponse<LoginHistoryResponse> searchLogins(String username, int page, int size) {
        Pageable pageable = PageParams.ofDescending(page, size, "occurredAt");
        Page<LoginHistory> result = username == null || username.isBlank()
                ? loginHistory.findAll(pageable)
                : loginHistory.findByUsernameAttempted(TextNormalizer.username(username), pageable);
        return PageResponse.from(result, LoginHistoryResponse::from);
    }
}
