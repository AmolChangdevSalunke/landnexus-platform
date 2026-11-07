package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.ComponentType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

/** One explained line of an estimate: which component, how it was calculated, and the amount. */
@Entity
@Table(name = "valuation_lines")
public class ValuationLine {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "valuation_id", nullable = false, updatable = false) private UUID valuationId;
    @Column(name = "position", nullable = false, updatable = false) private int position;
    @Column(name = "component_code", nullable = false, length = 40, updatable = false) private String componentCode;
    @Column(name = "component_name", nullable = false, length = 100, updatable = false) private String componentName;
    @Enumerated(EnumType.STRING) @Column(name = "component_type", nullable = false, length = 30, updatable = false) private ComponentType componentType;
    @Column(name = "basis", nullable = false, length = 300, updatable = false) private String basis;
    @Column(name = "amount", nullable = false, updatable = false, precision = 15, scale = 2) private BigDecimal amount;

    protected ValuationLine() { }

    public ValuationLine(UUID valuationId, int position, String componentCode, String componentName,
                         ComponentType componentType, String basis, BigDecimal amount) {
        this.valuationId = valuationId;
        this.position = position;
        this.componentCode = componentCode;
        this.componentName = componentName;
        this.componentType = componentType;
        this.basis = basis.length() > 300 ? basis.substring(0, 300) : basis;
        this.amount = amount;
    }

    public UUID getValuationId() { return valuationId; }
    public int getPosition() { return position; }
    public String getComponentCode() { return componentCode; }
    public String getComponentName() { return componentName; }
    public ComponentType getComponentType() { return componentType; }
    public String getBasis() { return basis; }
    public BigDecimal getAmount() { return amount; }
}