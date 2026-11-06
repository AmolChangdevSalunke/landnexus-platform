package com.landnexus.landrecords.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** One uploaded file. Append-only (database trigger). storedKey is internal and never sent to clients. */
@Entity
@Table(name = "land_document_versions")
public class LandDocumentVersion {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "document_id", nullable = false, updatable = false)
    private UUID documentId;
    @Column(name = "version_no", nullable = false, updatable = false)
    private int versionNo;
    @Column(name = "original_filename", nullable = false, length = 255, updatable = false)
    private String originalFilename;
    @Column(name = "stored_key", nullable = false, length = 120, updatable = false)
    private String storedKey;
    @Column(name = "content_type", nullable = false, length = 100, updatable = false)
    private String contentType;
    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;
    @Column(name = "sha256", nullable = false, length = 64, updatable = false)
    private String sha256;
    @Column(name = "uploaded_by_user_id", updatable = false)
    private UUID uploadedByUserId;
    @Column(name = "uploaded_by_username", nullable = false, length = 100, updatable = false)
    private String uploadedByUsername;
    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt;

    protected LandDocumentVersion() { }

    public LandDocumentVersion(UUID documentId, int versionNo, String originalFilename, String storedKey,
                               String contentType, long sizeBytes, String sha256, UUID uploadedByUserId,
                               String uploadedByUsername, Instant uploadedAt) {
        this.documentId = documentId;
        this.versionNo = versionNo;
        this.originalFilename = originalFilename;
        this.storedKey = storedKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
        this.uploadedByUserId = uploadedByUserId;
        this.uploadedByUsername = uploadedByUsername;
        this.uploadedAt = uploadedAt;
    }

    public UUID getId() { return id; }
    public UUID getDocumentId() { return documentId; }
    public int getVersionNo() { return versionNo; }
    public String getOriginalFilename() { return originalFilename; }
    public String getStoredKey() { return storedKey; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getSha256() { return sha256; }
    public UUID getUploadedByUserId() { return uploadedByUserId; }
    public String getUploadedByUsername() { return uploadedByUsername; }
    public Instant getUploadedAt() { return uploadedAt; }
}