package com.landnexus.landrecords.domain;

import com.landnexus.landrecords.domain.LandTypes.LandClassification;
import com.landnexus.landrecords.domain.LandTypes.LandUse;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A piece of land identified by village + Gat / Survey / Subdivision number. The village never changes. */
@Entity
@Table(name = "land_parcels")
@EntityListeners(AuditingEntityListener.class)
public class LandParcel {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "state_id", nullable = false, updatable = false)
    private UUID stateId;
    @Column(name = "district_id", nullable = false, updatable = false)
    private UUID districtId;
    @Column(name = "taluka_id", nullable = false, updatable = false)
    private UUID talukaId;
    @Column(name = "village_id", nullable = false, updatable = false)
    private UUID villageId;

    @Column(name = "gat_number", length = 30)
    private String gatNumber;
    @Column(name = "survey_number", length = 30)
    private String surveyNumber;
    @Column(name = "subdivision_number", length = 30)
    private String subdivisionNumber;

    /** Normalised "GAT|SURVEY|SUBDIVISION"; unique together with the village. */
    @Column(name = "parcel_key", nullable = false, length = 100)
    private String parcelKey;

    @Column(name = "area_ha", nullable = false, precision = 12, scale = 4)
    private BigDecimal areaHa;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false, length = 40)
    private LandClassification classification;

    @Enumerated(EnumType.STRING)
    @Column(name = "land_use", nullable = false, length = 40)
    private LandUse landUse;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ParcelStatus status = ParcelStatus.ACTIVE;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @CreatedBy
    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;
    @LastModifiedBy
    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @PrePersist
    void onCreate() { Instant now = Instant.now(); createdAt = now; updatedAt = now; }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getStateId() { return stateId; }
    public void setStateId(UUID v) { this.stateId = v; }
    public UUID getDistrictId() { return districtId; }
    public void setDistrictId(UUID v) { this.districtId = v; }
    public UUID getTalukaId() { return talukaId; }
    public void setTalukaId(UUID v) { this.talukaId = v; }
    public UUID getVillageId() { return villageId; }
    public void setVillageId(UUID v) { this.villageId = v; }
    public String getGatNumber() { return gatNumber; }
    public void setGatNumber(String v) { this.gatNumber = v; }
    public String getSurveyNumber() { return surveyNumber; }
    public void setSurveyNumber(String v) { this.surveyNumber = v; }
    public String getSubdivisionNumber() { return subdivisionNumber; }
    public void setSubdivisionNumber(String v) { this.subdivisionNumber = v; }
    public String getParcelKey() { return parcelKey; }
    public void setParcelKey(String v) { this.parcelKey = v; }
    public BigDecimal getAreaHa() { return areaHa; }
    public void setAreaHa(BigDecimal v) { this.areaHa = v; }
    public LandClassification getClassification() { return classification; }
    public void setClassification(LandClassification v) { this.classification = v; }
    public LandUse getLandUse() { return landUse; }
    public void setLandUse(LandUse v) { this.landUse = v; }
    public ParcelStatus getStatus() { return status; }
    public void setStatus(ParcelStatus v) { this.status = v; }
    public long getRowVersion() { return rowVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getCreatedBy() { return createdBy; }
    public String getUpdatedBy() { return updatedBy; }
}