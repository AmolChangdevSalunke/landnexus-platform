package com.landnexus.acquisition.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A geo-tagged photo of a surveyed parcel. Append-only. storedKey is internal and never sent to clients. */
@Entity
@Table(name = "survey_photos")
public class SurveyPhoto {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "survey_id", nullable = false, updatable = false) private UUID surveyId;
    @Column(name = "original_filename", nullable = false, length = 255, updatable = false) private String originalFilename;
    @Column(name = "stored_key", nullable = false, length = 120, updatable = false) private String storedKey;
    @Column(name = "content_type", nullable = false, length = 100, updatable = false) private String contentType;
    @Column(name = "size_bytes", nullable = false, updatable = false) private long sizeBytes;
    @Column(name = "sha256", nullable = false, length = 64, updatable = false) private String sha256;
    @Column(name = "gps_latitude", nullable = false, updatable = false, precision = 9, scale = 6) private BigDecimal gpsLatitude;
    @Column(name = "gps_longitude", nullable = false, updatable = false, precision = 9, scale = 6) private BigDecimal gpsLongitude;
    @Column(name = "captured_at", updatable = false) private Instant capturedAt;
    @Column(name = "uploaded_by_user_id", nullable = false, updatable = false) private UUID uploadedByUserId;
    @Column(name = "uploaded_by_username", nullable = false, length = 100, updatable = false) private String uploadedByUsername;
    @Column(name = "uploaded_at", nullable = false, updatable = false) private Instant uploadedAt;

    protected SurveyPhoto() { }

    public SurveyPhoto(UUID surveyId, String originalFilename, String storedKey, String contentType, long sizeBytes,
                       String sha256, BigDecimal gpsLatitude, BigDecimal gpsLongitude, Instant capturedAt,
                       UUID uploadedByUserId, String uploadedByUsername, Instant uploadedAt) {
        this.surveyId = surveyId;
        this.originalFilename = originalFilename;
        this.storedKey = storedKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
        this.gpsLatitude = gpsLatitude;
        this.gpsLongitude = gpsLongitude;
        this.capturedAt = capturedAt;
        this.uploadedByUserId = uploadedByUserId;
        this.uploadedByUsername = uploadedByUsername;
        this.uploadedAt = uploadedAt;
    }

    public UUID getId() { return id; }
    public UUID getSurveyId() { return surveyId; }
    public String getOriginalFilename() { return originalFilename; }
    public String getStoredKey() { return storedKey; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getSha256() { return sha256; }
    public BigDecimal getGpsLatitude() { return gpsLatitude; }
    public BigDecimal getGpsLongitude() { return gpsLongitude; }
    public Instant getCapturedAt() { return capturedAt; }
    public String getUploadedByUsername() { return uploadedByUsername; }
    public Instant getUploadedAt() { return uploadedAt; }
}