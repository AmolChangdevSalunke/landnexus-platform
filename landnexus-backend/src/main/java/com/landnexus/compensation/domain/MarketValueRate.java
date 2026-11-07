package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.RateStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A market value per hectare for a village and land classification, valid from a date. Approved rates never change. */
@Entity
@Table(name = "market_value_rates")
@EntityListeners(AuditingEntityListener.class)
public class MarketValueRate {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "village_id", nullable = false, updatable = false) private UUID villageId;
    @Column(name = "district_id", nullable = false, updatable = false) private UUID districtId;
    @Column(name = "classification", nullable = false, length = 40, updatable = false) private String classification;
    @Column(name = "rate_per_ha", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal ratePerHa;
    @Column(name = "effective_from", nullable = false, updatable = false) private LocalDate effectiveFrom;
    @Column(name = "source_note", length = 200, updatable = false) private String sourceNote;
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20) private RateStatus status = RateStatus.PENDING;
    @Column(name = "created_by_user_id", nullable = false, updatable = false) private UUID createdByUserId;
    @Column(name = "approved_by_user_id") private UUID approvedByUserId;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "decision_remarks", length = 500) private String decisionRemarks;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected MarketValueRate() { }

    public MarketValueRate(UUID villageId, UUID districtId, String classification, BigDecimal ratePerHa,
                           LocalDate effectiveFrom, String sourceNote, UUID createdByUserId) {
        this.villageId = villageId;
        this.districtId = districtId;
        this.classification = classification;
        this.ratePerHa = ratePerHa;
        this.effectiveFrom = effectiveFrom;
        this.sourceNote = sourceNote;
        this.createdByUserId = createdByUserId;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void decide(RateStatus outcome, UUID userId, Instant at, String remarks) {
        this.status = outcome;
        this.approvedByUserId = userId;
        this.decidedAt = at;
        this.decisionRemarks = remarks;
    }

    public UUID getId() { return id; }
    public UUID getVillageId() { return villageId; }
    public UUID getDistrictId() { return districtId; }
    public String getClassification() { return classification; }
    public BigDecimal getRatePerHa() { return ratePerHa; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public String getSourceNote() { return sourceNote; }
    public RateStatus getStatus() { return status; }
    public UUID getCreatedByUserId() { return createdByUserId; }
    public UUID getApprovedByUserId() { return approvedByUserId; }
    public Instant getDecidedAt() { return decidedAt; }
    public String getDecisionRemarks() { return decisionRemarks; }
    public Instant getCreatedAt() { return createdAt; }
}