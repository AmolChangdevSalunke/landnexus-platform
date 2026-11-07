package com.landnexus.acquisition.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** The award declared for a case. No money here: Module 5 attaches compensation to the award lines. */
@Entity
@Table(name = "acquisition_awards")
@EntityListeners(AuditingEntityListener.class)
public class AcquisitionAward {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false) private UUID caseId;
    @Column(name = "award_number", nullable = false, length = 40, updatable = false) private String awardNumber;
    @Column(name = "award_date", nullable = false, updatable = false) private LocalDate awardDate;
    @Column(name = "remarks", length = 1000, updatable = false) private String remarks;
    @Column(name = "declared_by_user_id", nullable = false, updatable = false) private UUID declaredByUserId;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected AcquisitionAward() { }

    public AcquisitionAward(UUID caseId, String awardNumber, LocalDate awardDate, String remarks, UUID declaredByUserId) {
        this.caseId = caseId;
        this.awardNumber = awardNumber;
        this.awardDate = awardDate;
        this.remarks = remarks;
        this.declaredByUserId = declaredByUserId;
    }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public String getAwardNumber() { return awardNumber; }
    public LocalDate getAwardDate() { return awardDate; }
    public String getRemarks() { return remarks; }
    public UUID getDeclaredByUserId() { return declaredByUserId; }
}