package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.RrBenefitKind;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** An entry of the configurable R&R benefit catalogue. Eligibility uses only neutral facts (home lost, livelihood lost). */
@Entity
@Table(name = "rr_benefit_types")
@EntityListeners(AuditingEntityListener.class)
public class RrBenefitType {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "code", nullable = false, length = 40, updatable = false) private String code;
    @Column(name = "name", nullable = false, length = 100) private String name;
    @Enumerated(EnumType.STRING) @Column(name = "kind", nullable = false, length = 20) private RrBenefitKind kind;
    @Column(name = "default_amount", precision = 15, scale = 2) private BigDecimal defaultAmount;
    @Column(name = "default_months") private Integer defaultMonths;
    @Column(name = "requires_displaced", nullable = false) private boolean requiresDisplaced;
    @Column(name = "requires_livelihood_lost", nullable = false) private boolean requiresLivelihoodLost;
    @Column(name = "active", nullable = false) private boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected RrBenefitType() { }

    public RrBenefitType(String code, String name, RrBenefitKind kind, BigDecimal defaultAmount, Integer defaultMonths,
                         boolean requiresDisplaced, boolean requiresLivelihoodLost) {
        this.code = code;
        this.name = name;
        this.kind = kind;
        this.defaultAmount = defaultAmount;
        this.defaultMonths = defaultMonths;
        this.requiresDisplaced = requiresDisplaced;
        this.requiresLivelihoodLost = requiresLivelihoodLost;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public RrBenefitKind getKind() { return kind; }
    public BigDecimal getDefaultAmount() { return defaultAmount; }
    public Integer getDefaultMonths() { return defaultMonths; }
    public boolean isRequiresDisplaced() { return requiresDisplaced; }
    public boolean isRequiresLivelihoodLost() { return requiresLivelihoodLost; }
    public boolean isActive() { return active; }
}