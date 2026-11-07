package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.RuleSetStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * A versioned set of compensation components for a legal framework, valid for a period and a place
 * (a district, a state, or nationwide). Only the status fields ever change; components are written once.
 */
@Entity
@Table(name = "valuation_rule_sets")
@EntityListeners(AuditingEntityListener.class)
public class RuleSet {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "name", nullable = false, length = 100, updatable = false) private String name;
    @Column(name = "version", nullable = false, updatable = false) private int version;
    @Column(name = "framework", nullable = false, length = 40, updatable = false) private String framework;
    @Column(name = "state_id", updatable = false) private UUID stateId;
    @Column(name = "district_id", updatable = false) private UUID districtId;
    @Column(name = "effective_from", nullable = false, updatable = false) private LocalDate effectiveFrom;
    @Column(name = "effective_to", updatable = false) private LocalDate effectiveTo;
    @Column(name = "description", length = 500, updatable = false) private String description;
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20) private RuleSetStatus status = RuleSetStatus.DRAFT;
    @Column(name = "created_by_user_id", nullable = false, updatable = false) private UUID createdByUserId;
    @Column(name = "approved_by_user_id") private UUID approvedByUserId;
    @Column(name = "approved_at") private Instant approvedAt;
    @Column(name = "retire_reason", length = 500) private String retireReason;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected RuleSet() { }

    public RuleSet(String name, int version, String framework, UUID stateId, UUID districtId, LocalDate effectiveFrom,
                   LocalDate effectiveTo, String description, UUID createdByUserId) {
        this.name = name;
        this.version = version;
        this.framework = framework;
        this.stateId = stateId;
        this.districtId = districtId;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.description = description;
        this.createdByUserId = createdByUserId;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void approve(UUID userId, Instant at) {
        this.status = RuleSetStatus.APPROVED;
        this.approvedByUserId = userId;
        this.approvedAt = at;
    }

    public void retire(String reason) {
        this.status = RuleSetStatus.RETIRED;
        this.retireReason = reason;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public int getVersion() { return version; }
    public String getFramework() { return framework; }
    public UUID getStateId() { return stateId; }
    public UUID getDistrictId() { return districtId; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public String getDescription() { return description; }
    public RuleSetStatus getStatus() { return status; }
    public UUID getCreatedByUserId() { return createdByUserId; }
    public UUID getApprovedByUserId() { return approvedByUserId; }
    public Instant getApprovedAt() { return approvedAt; }
    public String getRetireReason() { return retireReason; }
    public Instant getCreatedAt() { return createdAt; }
}