package com.landnexus.landrecords.domain;

import com.landnexus.landrecords.domain.LandTypes.DocumentCategory;
import com.landnexus.landrecords.domain.LandTypes.VerificationStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A parcel document. Verification is a manual human decision about the CURRENT version; a new version resets it. */
@Entity
@Table(name = "land_documents")
@EntityListeners(AuditingEntityListener.class)
public class LandDocument {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "parcel_id", nullable = false, updatable = false)
    private UUID parcelId;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30, updatable = false)
    private DocumentCategory category;

    @Column(name = "title", nullable = false, length = 200)
    private String title;
    @Column(name = "current_version_no", nullable = false)
    private int currentVersionNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    @Column(name = "verified_version_no")
    private Integer verifiedVersionNo;
    @Column(name = "verified_by_user_id")
    private UUID verifiedByUserId;
    @Column(name = "verified_at")
    private Instant verifiedAt;
    @Column(name = "verification_remarks", length = 500)
    private String verificationRemarks;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @CreatedBy
    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;
    @LastModifiedBy
    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    protected LandDocument() { }

    public LandDocument(UUID parcelId, DocumentCategory category, String title) {
        this.parcelId = parcelId;
        this.category = category;
        this.title = title;
    }

    @PrePersist
    void onCreate() { Instant now = Instant.now(); createdAt = now; updatedAt = now; }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    /** A new file invalidates any earlier decision. */
    public void startNewVersion(int versionNo) {
        this.currentVersionNo = versionNo;
        this.verificationStatus = VerificationStatus.PENDING;
        this.verifiedVersionNo = null;
        this.verifiedByUserId = null;
        this.verifiedAt = null;
        this.verificationRemarks = null;
    }

    public void decide(VerificationStatus status, UUID userId, Instant at, String remarks) {
        this.verificationStatus = status;
        this.verifiedVersionNo = currentVersionNo;
        this.verifiedByUserId = userId;
        this.verifiedAt = at;
        this.verificationRemarks = remarks;
    }

    public UUID getId() { return id; }
    public UUID getParcelId() { return parcelId; }
    public DocumentCategory getCategory() { return category; }
    public String getTitle() { return title; }
    public int getCurrentVersionNo() { return currentVersionNo; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; }
    public Integer getVerifiedVersionNo() { return verifiedVersionNo; }
    public UUID getVerifiedByUserId() { return verifiedByUserId; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public String getVerificationRemarks() { return verificationRemarks; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}