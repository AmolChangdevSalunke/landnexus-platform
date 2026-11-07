package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Every status change of a case with actor, time and reason. Append-only (database trigger). */
@Entity
@Table(name = "acquisition_case_history")
public class CaseStatusHistory {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;
    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30, updatable = false)
    private CaseStatus fromStatus;
    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30, updatable = false)
    private CaseStatus toStatus;
    @Column(name = "action", nullable = false, length = 40, updatable = false)
    private String action;
    @Column(name = "actor_user_id", updatable = false)
    private UUID actorUserId;
    @Column(name = "actor_username", nullable = false, length = 100, updatable = false)
    private String actorUsername;
    @Column(name = "reason", length = 1000, updatable = false)
    private String reason;
    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected CaseStatusHistory() { }

    public CaseStatusHistory(UUID caseId, CaseStatus from, CaseStatus to, String action, UUID actorUserId,
                             String actorUsername, String reason, Instant occurredAt) {
        this.caseId = caseId;
        this.fromStatus = from;
        this.toStatus = to;
        this.action = action;
        this.actorUserId = actorUserId;
        this.actorUsername = actorUsername;
        this.reason = reason;
        this.occurredAt = occurredAt;
    }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public CaseStatus getFromStatus() { return fromStatus; }
    public CaseStatus getToStatus() { return toStatus; }
    public String getAction() { return action; }
    public String getActorUsername() { return actorUsername; }
    public String getReason() { return reason; }
    public Instant getOccurredAt() { return occurredAt; }
}