package com.landnexus.projects.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One routing record for a proposal stage. Append-only in spirit: a reassignment closes the old row with
 * status REASSIGNED and opens a new one. The database enforces at most one open row per proposal and stage.
 */
@Entity
@Table(name = "proposal_assignments")
public class ProposalAssignment {

    public static final String STAGE_SCRUTINY = "SCRUTINY";
    public static final String STAGE_DECISION = "DECISION";

    public static final String PENDING = "PENDING";
    public static final String IN_PROGRESS = "IN_PROGRESS";
    public static final String COMPLETED = "COMPLETED";
    public static final String REASSIGNED = "REASSIGNED";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "proposal_id", nullable = false, updatable = false)
    private UUID proposalId;

    @Column(name = "stage", nullable = false, length = 20, updatable = false)
    private String stage;

    @Column(name = "assigned_user_id", nullable = false)
    private UUID assignedUserId;

    @Column(name = "assigned_by", nullable = false, length = 100)
    private String assignedBy = "SYSTEM";

    @Column(name = "rule_note", length = 300)
    private String ruleNote;

    @Column(name = "status", nullable = false, length = 20)
    private String status = PENDING;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "due_at")
    private Instant dueAt;

    protected ProposalAssignment() {
    }

    public ProposalAssignment(UUID proposalId, String stage, UUID assignedUserId, String assignedBy,
                              String ruleNote, Instant assignedAt, Instant dueAt) {
        this.proposalId = proposalId;
        this.stage = stage;
        this.assignedUserId = assignedUserId;
        this.assignedBy = assignedBy == null || assignedBy.isBlank() ? "SYSTEM" : assignedBy;
        this.ruleNote = ruleNote;
        this.assignedAt = assignedAt;
        this.dueAt = dueAt;
        this.status = PENDING;
    }

    public UUID getId() { return id; }
    public UUID getProposalId() { return proposalId; }
    public String getStage() { return stage; }
    public UUID getAssignedUserId() { return assignedUserId; }
    public void setAssignedUserId(UUID assignedUserId) { this.assignedUserId = assignedUserId; }
    public String getAssignedBy() { return assignedBy; }
    public void setAssignedBy(String assignedBy) { this.assignedBy = assignedBy; }
    public String getRuleNote() { return ruleNote; }
    public void setRuleNote(String ruleNote) { this.ruleNote = ruleNote; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getAssignedAt() { return assignedAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public Instant getDueAt() { return dueAt; }
}
