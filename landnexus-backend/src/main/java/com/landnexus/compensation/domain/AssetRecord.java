package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.AssetCategory;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A building, tree, well or crop on an affected parcel with its value. Corrected by voiding, never by editing. */
@Entity
@Table(name = "asset_records")
@EntityListeners(AuditingEntityListener.class)
public class AssetRecord {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_parcel_id", nullable = false, updatable = false) private UUID caseParcelId;
    @Enumerated(EnumType.STRING) @Column(name = "category", nullable = false, length = 20, updatable = false) private AssetCategory category;
    @Column(name = "description", nullable = false, length = 200, updatable = false) private String description;
    @Column(name = "quantity", nullable = false, updatable = false, precision = 12, scale = 3) private BigDecimal quantity;
    @Column(name = "unit", nullable = false, length = 20, updatable = false) private String unit;
    @Column(name = "unit_value", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal unitValue;
    @Column(name = "value", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal value;
    @Column(name = "voided", nullable = false) private boolean voided;
    @Column(name = "void_reason", length = 500) private String voidReason;
    @Column(name = "entered_by_user_id", nullable = false, updatable = false) private UUID enteredByUserId;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected AssetRecord() { }

    public AssetRecord(UUID caseParcelId, AssetCategory category, String description, BigDecimal quantity, String unit,
                       BigDecimal unitValue, BigDecimal value, UUID enteredByUserId) {
        this.caseParcelId = caseParcelId;
        this.category = category;
        this.description = description;
        this.quantity = quantity;
        this.unit = unit;
        this.unitValue = unitValue;
        this.value = value;
        this.enteredByUserId = enteredByUserId;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void voidIt(String reason) {
        this.voided = true;
        this.voidReason = reason;
    }

    public UUID getId() { return id; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public AssetCategory getCategory() { return category; }
    public String getDescription() { return description; }
    public BigDecimal getQuantity() { return quantity; }
    public String getUnit() { return unit; }
    public BigDecimal getUnitValue() { return unitValue; }
    public BigDecimal getValue() { return value; }
    public boolean isVoided() { return voided; }
    public String getVoidReason() { return voidReason; }
}