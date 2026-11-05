package com.landnexus.landrecords.domain;

import com.landnexus.landrecords.domain.LandTypes.OwnerType;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * A person or body that owns land. SENSITIVE personal data: shown only to LANDOWNER_READ holders, every view audited,
 * and never copied into audit text. No government ID numbers are stored. Belongs to one district (scope is checked there).
 */
@Entity
@Table(name = "landowners")
@EntityListeners(AuditingEntityListener.class)
public class Landowner {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "district_id", nullable = false, updatable = false)
    private UUID districtId;

    @Enumerated(EnumType.STRING)
    @Column(name = "owner_type", nullable = false, length = 20)
    private OwnerType ownerType;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;
    @Column(name = "guardian_name", length = 200)
    private String guardianName;
    @Column(name = "address", length = 500)
    private String address;
    @Column(name = "phone", length = 20)
    private String phone;

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
    public UUID getDistrictId() { return districtId; }
    public void setDistrictId(UUID v) { this.districtId = v; }
    public OwnerType getOwnerType() { return ownerType; }
    public void setOwnerType(OwnerType v) { this.ownerType = v; }
    public String getFullName() { return fullName; }
    public void setFullName(String v) { this.fullName = v; }
    public String getGuardianName() { return guardianName; }
    public void setGuardianName(String v) { this.guardianName = v; }
    public String getAddress() { return address; }
    public void setAddress(String v) { this.address = v; }
    public String getPhone() { return phone; }
     public void setPhone(String v) { this.phone = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getCreatedBy() { return createdBy; }
    public String getUpdatedBy() { return updatedBy; }
}