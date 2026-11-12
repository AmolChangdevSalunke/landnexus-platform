package com.landnexus.projects.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A DEMO routing rule: which decision level receives a proposal of a given type and area band. */
@Entity
@Table(name = "routing_rules")
public class RoutingRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "min_area_ha", precision = 12, scale = 2)
    private BigDecimal minAreaHa;

    @Column(name = "max_area_ha", precision = 12, scale = 2)
    private BigDecimal maxAreaHa;

    @Column(name = "project_type", length = 40)
    private String projectType;

    @Column(name = "decision_level", nullable = false, length = 20)
    private String decisionLevel;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "note", length = 300)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected RoutingRule() {
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getMinAreaHa() { return minAreaHa; }
    public BigDecimal getMaxAreaHa() { return maxAreaHa; }
    public String getProjectType() { return projectType; }
    public String getDecisionLevel() { return decisionLevel; }
    public boolean isActive() { return active; }
    public String getNote() { return note; }
    public Instant getCreatedAt() { return createdAt; }
}
