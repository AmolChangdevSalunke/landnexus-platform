package com.landnexus.acquisition.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A parcel (or part of it) identified as affected by a case. Released when the case is cancelled or closed. */
@Entity
@Table(name = "case_parcels")
@EntityListeners(AuditingEntityListener.class)
public class CaseParcel {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;
    @Column(name = "parcel_id", nullable = false, updatable = false)
    private UUID parcelId;
    @Column(name = "village_id", nullable = false, updatable = false)
    private UUID villageId;
    @Column(name = "area_to_acquire_ha", nullable = false, precision = 12, scale = 4)
    private BigDecimal areaToAcquireHa;
    @Column(name = "assigned_surveyor_user_id")
    private UUID assignedSurveyorUserId;
    @CreatedBy
    @Column(name = "identified_by", length = 100, updatable = false)
    private String identifiedBy;
    @Column(name = "identified_at", nullable = false, updatable = false)
    private Instant identifiedAt;
    @Column(name = "released_at")
    private Instant releasedAt;

    protected CaseParcel() { }

    public CaseParcel(UUID caseId, UUID parcelId, UUID villageId, BigDecimal areaToAcquireHa) {
        this.caseId = caseId;
        this.parcelId = parcelId;
        this.villageId = villageId;
        this.areaToAcquireHa = areaToAcquireHa;
    }

    @PrePersist
    void onCreate() { identifiedAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public UUID getParcelId() { return parcelId; }
    public UUID getVillageId() { return villageId; }
    public BigDecimal getAreaToAcquireHa() { return areaToAcquireHa; }
    public UUID getAssignedSurveyorUserId() { return assignedSurveyorUserId; }
    public void setAssignedSurveyorUserId(UUID v) { this.assignedSurveyorUserId = v; }
    public String getIdentifiedBy() { return identifiedBy; }
    public Instant getIdentifiedAt() { return identifiedAt; }
    public Instant getReleasedAt() { return releasedAt; }
}