package com.landnexus.projects.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Every status change with actor, time and reason. Append-only: the database refuses UPDATE and DELETE. */
@Entity
@Table(name = "proposal_status_history")
public class ProposalStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "proposal_id", nullable = false, updatable = false)
    private UUID proposalId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30, updatable = false)
    private ProposalStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30, updatable = false)
    private ProposalStatus toStatus;

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

    protected ProposalStatusHistory() {
    }

    public ProposalStatusHistory(UUID proposalId, ProposalStatus fromStatus, ProposalStatus toStatus, String action,
                                 UUID actorUserId, String actorUsername, String reason, Instant occurredAt) {
        this.proposalId = proposalId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.action = action;
        this.actorUserId = actorUserId;
        this.actorUsername = actorUsername;
        this.reason = reason;
        this.occurredAt = occurredAt;
    }

    public UUID getId() { return id; }
    public UUID getProposalId() { return proposalId; }
    public ProposalStatus getFromStatus() { return fromStatus; }
    public ProposalStatus getToStatus() { return toStatus; }
    public String getAction() { return action; }
    public UUID getActorUserId() { return actorUserId; }
    public String getActorUsername() { return actorUsername; }
    public String getReason() { return reason; }
    public Instant getOccurredAt() { return occurredAt; }
}
