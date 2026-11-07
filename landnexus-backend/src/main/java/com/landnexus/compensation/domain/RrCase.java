package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.RrCaseStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** The R&R file of one affected family (landowner) within an acquisition case. Ids only: no personal data. */
@Entity
@Table(name = "rr_cases")
@EntityListeners(AuditingEntityListener.class)
public class RrCase {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false) private UUID caseId;
    @Column(name = "landowner_id", nullable = false, updatable = false) private UUID landownerId;
    @Column(name = "displaced", nullable = false, updatable = false) private boolean displaced;
    @Column(name = "livelihood_lost", nullable = false, updatable = false) private boolean livelihoodLost;
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20) private RrCaseStatus status = RrCaseStatus.IDENTIFIED;
    @Column(name = "notes", length = 500, updatable = false) private String notes;
    @Column(name = "created_by_user_id", nullable = false, updatable = false) private UUID createdByUserId;
    @Column(name = "approved_by_user_id") private UUID approvedByUserId;
    @Column(name = "decided_at") private Instant decidedAt;
    @Version @Column(name = "row_version", nullable = false) private long rowVersion;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected RrCase() { }

    public RrCase(UUID caseId, UUID landownerId, boolean displaced, boolean livelihoodLost, String notes, UUID createdByUserId) {
        this.caseId = caseId;
        this.landownerId = landownerId;
        this.displaced = displaced;
        this.livelihoodLost = livelihoodLost;
        this.notes = notes;
        this.createdByUserId = createdByUserId;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void markAssessed() { this.status = RrCaseStatus.ASSESSED; }

    public void approve(UUID userId, Instant at) {
        this.status = RrCaseStatus.APPROVED;
        this.approvedByUserId = userId;
        this.decidedAt = at;
    }

    public void complete() { this.status = RrCaseStatus.COMPLETED; }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public UUID getLandownerId() { return landownerId; }
    public boolean isDisplaced() { return displaced; }
    public boolean isLivelihoodLost() { return livelihoodLost; }
    public RrCaseStatus getStatus() { return status; }
    public String getNotes() { return notes; }
    public UUID getCreatedByUserId() { return createdByUserId; }
    public UUID getApprovedByUserId() { return approvedByUserId; }
    public Instant getDecidedAt() { return decidedAt; }
}