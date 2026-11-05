package com.landnexus.projects.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A frozen copy of the proposal as it was when submitted (version 1) or resubmitted (2, 3, ...). Append-only. */
@Entity
@Table(name = "proposal_versions")
public class ProposalVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "proposal_id", nullable = false, updatable = false)
    private UUID proposalId;

    @Column(name = "version_no", nullable = false, updatable = false)
    private int versionNo;

    @Column(name = "snapshot", nullable = false, length = 5000, updatable = false)
    private String snapshot;

    @Column(name = "created_by_user_id", updatable = false)
    private UUID createdByUserId;

    @Column(name = "created_by_username", nullable = false, length = 100, updatable = false)
    private String createdByUsername;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ProposalVersion() {
    }

    public ProposalVersion(UUID proposalId, int versionNo, String snapshot, UUID createdByUserId,
                           String createdByUsername, Instant createdAt) {
        this.proposalId = proposalId;
        this.versionNo = versionNo;
        this.snapshot = snapshot.length() > 5000 ? snapshot.substring(0, 5000) : snapshot;
        this.createdByUserId = createdByUserId;
        this.createdByUsername = createdByUsername;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getProposalId() { return proposalId; }
    public int getVersionNo() { return versionNo; }
    public String getSnapshot() { return snapshot; }
    public UUID getCreatedByUserId() { return createdByUserId; }
    public String getCreatedByUsername() { return createdByUsername; }
    public Instant getCreatedAt() { return createdAt; }
}
