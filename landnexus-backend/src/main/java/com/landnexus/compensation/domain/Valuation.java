package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.ValuationStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * A compensation estimate for one awarded parcel. The numbers, the rule-set version and the rate used are frozen
 * when it is computed, so the result can be reproduced and explained later. Only the status moves.
 */
@Entity
@Table(name = "valuations")
@EntityListeners(AuditingEntityListener.class)
public class Valuation {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false) private UUID caseId;
    @Column(name = "case_parcel_id", nullable = false, updatable = false) private UUID caseParcelId;
    @Column(name = "parcel_id", nullable = false, updatable = false) private UUID parcelId;
    @Column(name = "version_no", nullable = false, updatable = false) private int versionNo;
    @Column(name = "awarded_area_ha", nullable = false, updatable = false, precision = 12, scale = 4) private BigDecimal awardedAreaHa;
    @Column(name = "classification", nullable = false, length = 40, updatable = false) private String classification;
    @Column(name = "rate_id", nullable = false, updatable = false) private UUID rateId;
    @Column(name = "rate_per_ha", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal ratePerHa;
    @Column(name = "rule_set_id", nullable = false, updatable = false) private UUID ruleSetId;
    @Column(name = "rule_set_name", nullable = false, length = 100, updatable = false) private String ruleSetName;
    @Column(name = "rule_set_version", nullable = false, updatable = false) private int ruleSetVersion;
    @Column(name = "reference_date", nullable = false, updatable = false) private LocalDate referenceDate;
    @Column(name = "asset_total", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal assetTotal;
    @Column(name = "total_amount", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal totalAmount;
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20) private ValuationStatus status = ValuationStatus.DRAFT;
    @Column(name = "prepared_by_user_id", nullable = false, updatable = false) private UUID preparedByUserId;
    @Column(name = "prepared_by_username", nullable = false, length = 100, updatable = false) private String preparedByUsername;
    @Column(name = "decided_by_user_id") private UUID decidedByUserId;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "decision_remarks", length = 1000) private String decisionRemarks;
    @Version @Column(name = "row_version", nullable = false) private long rowVersion;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected Valuation() { }

    public Valuation(UUID caseId, UUID caseParcelId, UUID parcelId, int versionNo, BigDecimal awardedAreaHa,
                     String classification, UUID rateId, BigDecimal ratePerHa, UUID ruleSetId, String ruleSetName,
                     int ruleSetVersion, LocalDate referenceDate, BigDecimal assetTotal, BigDecimal totalAmount,
                     UUID preparedByUserId, String preparedByUsername) {
        this.caseId = caseId;
        this.caseParcelId = caseParcelId;
        this.parcelId = parcelId;
        this.versionNo = versionNo;
        this.awardedAreaHa = awardedAreaHa;
        this.classification = classification;
        this.rateId = rateId;
        this.ratePerHa = ratePerHa;
        this.ruleSetId = ruleSetId;
        this.ruleSetName = ruleSetName;
        this.ruleSetVersion = ruleSetVersion;
        this.referenceDate = referenceDate;
        this.assetTotal = assetTotal;
        this.totalAmount = totalAmount;
        this.preparedByUserId = preparedByUserId;
        this.preparedByUsername = preparedByUsername;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void submit() { this.status = ValuationStatus.SUBMITTED; }

    public void supersede() { this.status = ValuationStatus.SUPERSEDED; }

    public void decide(ValuationStatus outcome, UUID userId, Instant at, String remarks) {
        this.status = outcome;
        this.decidedByUserId = userId;
        this.decidedAt = at;
        this.decisionRemarks = remarks;
    }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public UUID getParcelId() { return parcelId; }
    public int getVersionNo() { return versionNo; }
    public BigDecimal getAwardedAreaHa() { return awardedAreaHa; }
    public String getClassification() { return classification; }
    public UUID getRateId() { return rateId; }
    public BigDecimal getRatePerHa() { return ratePerHa; }
    public UUID getRuleSetId() { return ruleSetId; }
    public String getRuleSetName() { return ruleSetName; }
    public int getRuleSetVersion() { return ruleSetVersion; }
    public LocalDate getReferenceDate() { return referenceDate; }
    public BigDecimal getAssetTotal() { return assetTotal; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public ValuationStatus getStatus() { return status; }
    public UUID getPreparedByUserId() { return preparedByUserId; }
    public String getPreparedByUsername() { return preparedByUsername; }
    public UUID getDecidedByUserId() { return decidedByUserId; }
    public Instant getDecidedAt() { return decidedAt; }
    public String getDecisionRemarks() { return decisionRemarks; }
    public Instant getCreatedAt() { return createdAt; }
}