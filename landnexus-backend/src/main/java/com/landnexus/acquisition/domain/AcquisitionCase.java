package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.AcquisitionFramework;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A land-acquisition case for one approved project. rowVersion makes simultaneous changes conflict (409). */
@Entity
@Table(name = "acquisition_cases")
@EntityListeners(AuditingEntityListener.class)
public class AcquisitionCase {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_number", nullable = false, length = 30, updatable = false)
    private String caseNumber;
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;
    @Column(name = "state_id", nullable = false, updatable = false)
    private UUID stateId;
    @Column(name = "district_id", nullable = false, updatable = false)
    private UUID districtId;

    @Enumerated(EnumType.STRING)
    @Column(name = "framework", nullable = false, length = 40)
    private AcquisitionFramework framework;
    @Column(name = "framework_note", length = 300)
    private String frameworkNote;
    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private CaseStatus status = CaseStatus.INITIATED;

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
    @CollectionTable(name = "case_villages", joinColumns = @JoinColumn(name = "case_id"))
    @Column(name = "village_id", nullable = false)
    private Set<UUID> villageIds = new HashSet<>();

    @PrePersist
    void onCreate() { Instant now = Instant.now(); createdAt = now; updatedAt = now; }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getCaseNumber() { return caseNumber; }
    public void setCaseNumber(String v) { this.caseNumber = v; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID v) { this.projectId = v; }
    public UUID getStateId() { return stateId; }
    public void setStateId(UUID v) { this.stateId = v; }
    public UUID getDistrictId() { return districtId; }
    public void setDistrictId(UUID v) { this.districtId = v; }
    public AcquisitionFramework getFramework() { return framework; }
    public void setFramework(AcquisitionFramework v) { this.framework = v; }
    public String getFrameworkNote() { return frameworkNote; }
    public void setFrameworkNote(String v) { this.frameworkNote = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public CaseStatus getStatus() { return status; }
    public void setStatus(CaseStatus v) { this.status = v; }
    public long getRowVersion() { return rowVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getCreatedBy() { return createdBy; }
    public Set<UUID> getVillageIds() { return villageIds; }
}