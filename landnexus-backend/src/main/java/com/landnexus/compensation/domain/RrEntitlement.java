package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.EntitlementStatus;
import com.landnexus.compensation.domain.CompTypes.RrBenefitKind;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A benefit a family is entitled to, copied from the catalogue when assessed (later catalogue changes do not alter it). */
@Entity
@Table(name = "rr_entitlements")
public class RrEntitlement {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "rr_case_id", nullable = false, updatable = false) private UUID rrCaseId;
    @Column(name = "benefit_type_id", nullable = false, updatable = false) private UUID benefitTypeId;
    @Column(name = "benefit_code", nullable = false, length = 40, updatable = false) private String benefitCode;
    @Column(name = "benefit_name", nullable = false, length = 100, updatable = false) private String benefitName;
    @Enumerated(EnumType.STRING) @Column(name = "kind", nullable = false, length = 20, updatable = false) private RrBenefitKind kind;
    @Column(name = "amount", updatable = false, precision = 15, scale = 2) private BigDecimal amount;
    @Column(name = "months", updatable = false) private Integer months;
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20) private EntitlementStatus status = EntitlementStatus.PLANNED;
    @Column(name = "delivered_on") private LocalDate deliveredOn;
    @Column(name = "delivery_remarks", length = 500) private String deliveryRemarks;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected RrEntitlement() { }

    public RrEntitlement(UUID rrCaseId, UUID benefitTypeId, String benefitCode, String benefitName, RrBenefitKind kind,
                         BigDecimal amount, Integer months) {
        this.rrCaseId = rrCaseId;
        this.benefitTypeId = benefitTypeId;
        this.benefitCode = benefitCode;
        this.benefitName = benefitName;
        this.kind = kind;
        this.amount = amount;
        this.months = months;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void deliver(LocalDate on, String remarks) {
        this.status = EntitlementStatus.DELIVERED;
        this.deliveredOn = on;
        this.deliveryRemarks = remarks;
    }

    public UUID getId() { return id; }
    public UUID getRrCaseId() { return rrCaseId; }
    public UUID getBenefitTypeId() { return benefitTypeId; }
    public String getBenefitCode() { return benefitCode; }
    public String getBenefitName() { return benefitName; }
    public RrBenefitKind getKind() { return kind; }
    public BigDecimal getAmount() { return amount; }
    public Integer getMonths() { return months; }
    public EntitlementStatus getStatus() { return status; }
    public LocalDate getDeliveredOn() { return deliveredOn; }
    public String getDeliveryRemarks() { return deliveryRemarks; }
}