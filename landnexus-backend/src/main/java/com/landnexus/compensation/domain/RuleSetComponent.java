package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.ComponentType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** One line of a rule set. factor = multiplier (LAND_VALUE), percent (PERCENT_OF) or amount per hectare (FIXED_PER_HECTARE). */
@Entity
@Table(name = "rule_set_components")
public class RuleSetComponent {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "rule_set_id", nullable = false, updatable = false) private UUID ruleSetId;
    @Column(name = "position", nullable = false, updatable = false) private int position;
    @Column(name = "code", nullable = false, length = 40, updatable = false) private String code;
    @Column(name = "name", nullable = false, length = 100, updatable = false) private String name;
    @Enumerated(EnumType.STRING) @Column(name = "type", nullable = false, length = 30, updatable = false) private ComponentType type;
    @Column(name = "factor", nullable = false, updatable = false, precision = 15, scale = 6) private BigDecimal factor;
    @Column(name = "base_codes", length = 300, updatable = false) private String baseCodes;

    protected RuleSetComponent() { }

    public RuleSetComponent(UUID ruleSetId, int position, String code, String name, ComponentType type,
                            BigDecimal factor, List<String> baseCodes) {
        this.ruleSetId = ruleSetId;
        this.position = position;
        this.code = code;
        this.name = name;
        this.type = type;
        this.factor = factor;
        this.baseCodes = baseCodes == null || baseCodes.isEmpty() ? null : String.join(",", baseCodes);
    }

    public List<String> baseCodeList() {
        return baseCodes == null || baseCodes.isBlank() ? List.of() : List.of(baseCodes.split(","));
    }

    public UUID getId() { return id; }
    public UUID getRuleSetId() { return ruleSetId; }
    public int getPosition() { return position; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public ComponentType getType() { return type; }
    public BigDecimal getFactor() { return factor; }
}