package com.landnexus.landrecords.domain;

import com.landnexus.landrecords.domain.LandTypes.RevenueRecordType;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A 7/12 or 8A extract typed in by an officer (no OCR, no automatic reading of documents). */
@Entity
@Table(name = "revenue_records")
@EntityListeners(AuditingEntityListener.class)
public class RevenueRecord {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "parcel_id", nullable = false, updatable = false)
    private UUID parcelId;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_type", nullable = false, length = 20, updatable = false)
    private RevenueRecordType recordType;

    @Column(name = "extract_date", nullable = false, updatable = false)
    private LocalDate extractDate;
    @Column(name = "khata_number", length = 30, updatable = false)
    private String khataNumber;
    @Column(name = "particulars", nullable = false, length = 2000, updatable = false)
    private String particulars;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @CreatedBy
    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;

    protected RevenueRecord() { }

    public RevenueRecord(UUID parcelId, RevenueRecordType recordType, LocalDate extractDate, String khataNumber,
                         String particulars) {
        this.parcelId = parcelId;
        this.recordType = recordType;
        this.extractDate = extractDate;
        this.khataNumber = khataNumber;
        this.particulars = particulars;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getParcelId() { return parcelId; }
    public RevenueRecordType getRecordType() { return recordType; }
    public LocalDate getExtractDate() { return extractDate; }
    public String getKhataNumber() { return khataNumber; }
    public String getParticulars() { return particulars; }
    public Instant getCreatedAt() { return createdAt; }
    public String getCreatedBy() { return createdBy; }
}