package com.landnexus.administration.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Grants a user access to exactly one State, one Division or one District (the database enforces "exactly one"). */
@Entity
@Table(name = "user_geographic_scopes")
public class GeographicScope {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "state_id", updatable = false)
    private State state;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "division_id", updatable = false)
    private Division division;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_id", updatable = false)
    private District district;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;

    protected GeographicScope() {
    }

    public GeographicScope(UserAccount user, State state, Division division, District district, String createdBy) {
        this.user = user;
        this.state = state;
        this.division = division;
        this.district = district;
        this.createdBy = createdBy;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public String type() {
        if (state != null) {
            return "STATE";
        }
        return division != null ? "DIVISION" : "DISTRICT";
    }

    public UUID referenceId() {
        if (state != null) {
            return state.getId();
        }
        return division != null ? division.getId() : district.getId();
    }

    public String referenceName() {
        if (state != null) {
            return state.getName();
        }
        return division != null ? division.getName() : district.getName();
    }

    public UUID getId() { return id; }
    public UserAccount getUser() { return user; }
    public State getState() { return state; }
    public Division getDivision() { return division; }
    public District getDistrict() { return district; }
    public Instant getCreatedAt() { return createdAt; }
    public String getCreatedBy() { return createdBy; }
}
