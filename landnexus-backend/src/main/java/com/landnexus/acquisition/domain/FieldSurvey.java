package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.SurveyStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** One field survey of an affected parcel: measured area, GPS point and notes. Only the verification part changes later. */
@Entity
@Table(name = "field_surveys")
@EntityListeners(AuditingEntityListener.class)
public class FieldSurvey {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;
    @Column(name = "case_parcel_id", nullable = false, updatable = false)
    private UUID caseParcelId;
    @Column(name = "surveyor_user_id", nullable = false, updatable = false)
    private UUID surveyorUserId;
    @Column(name = "surveyor_username", nullable = false, length = 100, updatable = false)
    private String surveyorUsername;
    @Column(name = "surveyed_on", nullable = false, updatable = false)
    private LocalDate surveyedOn;
    @Column(name = "measured_area_ha", nullable = false, updatable = false, precision = 12, scale = 4)
    private BigDecimal measuredAreaHa;
    @Column(name = "recorded_area_ha", nullable = false, updatable = false, precision = 12, scale = 4)
    private BigDecimal recordedAreaHa;
    @Column(name = "variance_percent", nullable = false, updatable = false, precision = 8, scale = 2)
    private BigDecimal variancePercent;
    @Column(name = "gps_latitude", nullable = false, updatable = false, precision = 9, scale = 6)
    private BigDecimal gpsLatitude;
    @Column(name = "gps_longitude", nullable = false, updatable = false, precision = 9, scale = 6)
    private BigDecimal gpsLongitude;
    @Column(name = "field_notes", length = 2000, updatable = false)
    private String fieldNotes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SurveyStatus status = SurveyStatus.SUBMITTED;

    @Column(name = "verified_by_user_id")
    private UUID verifiedByUserId;
    @Column(name = "verified_at")
    private Instant verifiedAt;
    @Column(name = "verification_remarks", length = 500)
    private String verificationRemarks;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @CreatedBy
    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;

    protected FieldSurvey() { }

    public FieldSurvey(UUID caseId, UUID caseParcelId, UUID surveyorUserId, String surveyorUsername, LocalDate surveyedOn,
                       BigDecimal measuredAreaHa, BigDecimal recordedAreaHa, BigDecimal variancePercent,
                       BigDecimal gpsLatitude, BigDecimal gpsLongitude, String fieldNotes) {
        this.caseId = caseId;
        this.caseParcelId = caseParcelId;
        this.surveyorUserId = surveyorUserId;
        this.surveyorUsername = surveyorUsername;
        this.surveyedOn = surveyedOn;
        this.measuredAreaHa = measuredAreaHa;
        this.recordedAreaHa = recordedAreaHa;
        this.variancePercent = variancePercent;
        this.gpsLatitude = gpsLatitude;
        this.gpsLongitude = gpsLongitude;
        this.fieldNotes = fieldNotes;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public void decide(SurveyStatus outcome, UUID userId, Instant at, String remarks) {
        this.status = outcome;
        this.verifiedByUserId = userId;
        this.verifiedAt = at;
        this.verificationRemarks = remarks;
    }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public UUID getSurveyorUserId() { return surveyorUserId; }
    public String getSurveyorUsername() { return surveyorUsername; }
    public LocalDate getSurveyedOn() { return surveyedOn; }
    public BigDecimal getMeasuredAreaHa() { return measuredAreaHa; }
    public BigDecimal getRecordedAreaHa() { return recordedAreaHa; }
    public BigDecimal getVariancePercent() { return variancePercent; }
    public BigDecimal getGpsLatitude() { return gpsLatitude; }
    public BigDecimal getGpsLongitude() { return gpsLongitude; }
    public String getFieldNotes() { return fieldNotes; }
    public SurveyStatus getStatus() { return status; }
    public UUID getVerifiedByUserId() { return verifiedByUserId; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public String getVerificationRemarks() { return verificationRemarks; }
    public Instant getCreatedAt() { return createdAt; }
}