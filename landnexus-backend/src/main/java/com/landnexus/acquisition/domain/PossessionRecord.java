package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.PossessionType;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** The date and kind of possession taken of one affected parcel. */
@Entity
@Table(name = "possession_records")
@EntityListeners(AuditingEntityListener.class)
public class PossessionRecord {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false) private UUID caseId;
    @Column(name = "case_parcel_id", nullable = false, updatable = false) private UUID caseParcelId;
    @Column(name = "possession_date", nullable = false, updatable = false) private LocalDate possessionDate;
    @Enumerated(EnumType.STRING) @Column(name = "possession_type", nullable = false, length = 20, updatable = false)
    private PossessionType possessionType;
    @Column(name = "remarks", length = 500, updatable = false) private String remarks;
    @Column(name = "recorded_by_user_id", nullable = false, updatable = false) private UUID recordedByUserId;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected PossessionRecord() { }

    public PossessionRecord(UUID caseId, UUID caseParcelId, LocalDate possessionDate, PossessionType possessionType,
                            String remarks, UUID recordedByUserId) {
        this.caseId = caseId;
        this.caseParcelId = caseParcelId;
        this.possessionDate = possessionDate;
        this.possessionType = possessionType;
        this.remarks = remarks;
        this.recordedByUserId = recordedByUserId;
    }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public LocalDate getPossessionDate() { return possessionDate; }
    public PossessionType getPossessionType() { return possessionType; }
    public String getRemarks() { return remarks; }
    public UUID getRecordedByUserId() { return recordedByUserId; }
}