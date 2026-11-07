package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.PaymentStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** One owner's share of an approved estimate. SIMULATED only: no bank details exist anywhere in this system. */
@Entity
@Table(name = "compensation_payments")
@EntityListeners(AuditingEntityListener.class)
public class CompensationPayment {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "valuation_id", nullable = false, updatable = false) private UUID valuationId;
    @Column(name = "case_id", nullable = false, updatable = false) private UUID caseId;
    @Column(name = "case_parcel_id", nullable = false, updatable = false) private UUID caseParcelId;
    @Column(name = "landowner_id", nullable = false, updatable = false) private UUID landownerId;
    @Column(name = "share_percent", nullable = false, updatable = false, precision = 5, scale = 2) private BigDecimal sharePercent;
    @Column(name = "amount", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal amount;
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20) private PaymentStatus status = PaymentStatus.INSTRUCTED;
    @Column(name = "mode", nullable = false, length = 20) private String mode = "SIMULATED";
    @Column(name = "reference", length = 60) private String reference;
    @Column(name = "failure_reason", length = 500) private String failureReason;
    @Column(name = "attempt_count", nullable = false) private int attemptCount;
    @Column(name = "released_by_user_id") private UUID releasedByUserId;
    @Column(name = "released_at") private Instant releasedAt;
    @Column(name = "confirmed_at") private Instant confirmedAt;
    @Version @Column(name = "row_version", nullable = false) private long rowVersion;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected CompensationPayment() { }

    public CompensationPayment(UUID valuationId, UUID caseId, UUID caseParcelId, UUID landownerId,
                               BigDecimal sharePercent, BigDecimal amount) {
        this.valuationId = valuationId;
        this.caseId = caseId;
        this.caseParcelId = caseParcelId;
        this.landownerId = landownerId;
        this.sharePercent = sharePercent;
        this.amount = amount;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void markSent(String reference, String mode, UUID userId, Instant at) {
        this.status = PaymentStatus.SENT;
        this.reference = reference;
        this.mode = mode;
        this.releasedByUserId = userId;
        this.releasedAt = at;
        this.attemptCount++;
        this.failureReason = null;
    }

    public void confirm(Instant at) {
        this.status = PaymentStatus.CONFIRMED;
        this.confirmedAt = at;
    }

    public void fail(String reason) {
        this.status = PaymentStatus.FAILED;
        this.failureReason = reason;
    }

    public UUID getId() { return id; }
    public UUID getValuationId() { return valuationId; }
    public UUID getCaseId() { return caseId; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public UUID getLandownerId() { return landownerId; }
    public BigDecimal getSharePercent() { return sharePercent; }
    public BigDecimal getAmount() { return amount; }
    public PaymentStatus getStatus() { return status; }
    public String getMode() { return mode; }
    public String getReference() { return reference; }
    public String getFailureReason() { return failureReason; }
    public int getAttemptCount() { return attemptCount; }
    public Instant getReleasedAt() { return releasedAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public Instant getCreatedAt() { return createdAt; }
}