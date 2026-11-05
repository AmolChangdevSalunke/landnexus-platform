package com.landnexus.projects.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * A consultant's request to start a government project. It references geography and the department by id
 * only (the administration module owns those records). rowVersion makes two simultaneous changes conflict
 * instead of silently overwriting each other.
 */
@Entity
@Table(name = "proposals")
@EntityListeners(AuditingEntityListener.class)
public class Proposal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "proposal_number", length = 30)
    private String proposalNumber;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "project_type", nullable = false, length = 40)
    private ProjectType projectType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ProposalStatus status = ProposalStatus.DRAFT;

    @Column(name = "version_no", nullable = false)
    private int versionNo;

    @Column(name = "state_id", nullable = false)
    private UUID stateId;

    @Column(name = "district_id", nullable = false)
    private UUID districtId;

    @Column(name = "taluka_id")
    private UUID talukaId;

    @Column(name = "department_id", nullable = false)
    private UUID departmentId;

    @Column(name = "length_km", precision = 10, scale = 2)
    private BigDecimal lengthKm;

    @Column(name = "estimated_land_area_ha", nullable = false, precision = 12, scale = 2)
    private BigDecimal estimatedLandAreaHa;

    @Column(name = "alignment_description", length = 1000)
    private String alignmentDescription;

    @Column(name = "description", nullable = false, length = 2000)
    private String description;

    @Column(name = "planned_start_date", nullable = false)
    private LocalDate plannedStartDate;

    @Column(name = "planned_end_date", nullable = false)
    private LocalDate plannedEndDate;

    @Column(name = "owner_user_id", nullable = false, updatable = false)
    private UUID ownerUserId;

    @Column(name = "recommended_by_user_id")
    private UUID recommendedByUserId;

    @Column(name = "submitted_at")
    private Instant submittedAt;

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

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "proposal_villages", joinColumns = @JoinColumn(name = "proposal_id"))
    @Column(name = "village_id", nullable = false)
    private Set<UUID> villageIds = new HashSet<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getProposalNumber() { return proposalNumber; }
    public void setProposalNumber(String proposalNumber) { this.proposalNumber = proposalNumber; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public ProjectType getProjectType() { return projectType; }
    public void setProjectType(ProjectType projectType) { this.projectType = projectType; }
    public ProposalStatus getStatus() { return status; }
    public void setStatus(ProposalStatus status) { this.status = status; }
    public int getVersionNo() { return versionNo; }
    public void setVersionNo(int versionNo) { this.versionNo = versionNo; }
    public UUID getStateId() { return stateId; }
    public void setStateId(UUID stateId) { this.stateId = stateId; }
    public UUID getDistrictId() { return districtId; }
    public void setDistrictId(UUID districtId) { this.districtId = districtId; }
    public UUID getTalukaId() { return talukaId; }
    public void setTalukaId(UUID talukaId) { this.talukaId = talukaId; }
    public UUID getDepartmentId() { return departmentId; }
    public void setDepartmentId(UUID departmentId) { this.departmentId = departmentId; }
    public BigDecimal getLengthKm() { return lengthKm; }
    public void setLengthKm(BigDecimal lengthKm) { this.lengthKm = lengthKm; }
    public BigDecimal getEstimatedLandAreaHa() { return estimatedLandAreaHa; }
    public void setEstimatedLandAreaHa(BigDecimal estimatedLandAreaHa) { this.estimatedLandAreaHa = estimatedLandAreaHa; }
    public String getAlignmentDescription() { return alignmentDescription; }
    public void setAlignmentDescription(String alignmentDescription) { this.alignmentDescription = alignmentDescription; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDate getPlannedStartDate() { return plannedStartDate; }
    public void setPlannedStartDate(LocalDate plannedStartDate) { this.plannedStartDate = plannedStartDate; }
    public LocalDate getPlannedEndDate() { return plannedEndDate; }
    public void setPlannedEndDate(LocalDate plannedEndDate) { this.plannedEndDate = plannedEndDate; }
    public UUID getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(UUID ownerUserId) { this.ownerUserId = ownerUserId; }
    public UUID getRecommendedByUserId() { return recommendedByUserId; }
    public void setRecommendedByUserId(UUID recommendedByUserId) { this.recommendedByUserId = recommendedByUserId; }
    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }
    public long getRowVersion() { return rowVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getCreatedBy() { return createdBy; }
    public String getUpdatedBy() { return updatedBy; }
    public Set<UUID> getVillageIds() { return villageIds; }
}
