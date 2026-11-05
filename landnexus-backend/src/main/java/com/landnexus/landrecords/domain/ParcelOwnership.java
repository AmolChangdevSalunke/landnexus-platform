package com.landnexus.landrecords.domain;

import com.landnexus.landrecords.domain.LandTypes.OwnershipBasis;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Who owns how much of a parcel, and for which period. "Current" while toDate is empty. */
@Entity
@Table(name = "parcel_ownerships")
@EntityListeners(AuditingEntityListener.class)
public class ParcelOwnership {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "parcel_id", nullable = false, updatable = false)
    private UUID parcelId;
    @Column(name = "landowner_id", nullable = false, updatable = false)
    private UUID landownerId;
    @Column(name = "share_percent", nullable = false, updatable = false, precision = 5, scale = 2)
    private BigDecimal sharePercent;

    @Enumerated(EnumType.STRING)
    @Column(name = "basis", nullable = false, length = 20, updatable = false)
    private OwnershipBasis basis;

    @Column(name = "from_date", nullable = false, updatable = false)
    private LocalDate fromDate;
    @Column(name = "to_date")
    private LocalDate toDate;
    @Column(name = "remarks", length = 500)
    private String remarks;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @CreatedBy
    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;

    protected ParcelOwnership() { }

    public ParcelOwnership(UUID parcelId, UUID landownerId, BigDecimal sharePercent, OwnershipBasis basis,
                           LocalDate fromDate, String remarks) {
        this.parcelId = parcelId;
        this.landownerId = landownerId;
        this.sharePercent = sharePercent;
        this.basis = basis;
        this.fromDate = fromDate;
        this.remarks = remarks;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public boolean isCurrent() { return toDate == null; }

    public UUID getId() { return id; }
    public UUID getParcelId() { return parcelId; }
    public UUID getLandownerId() { return landownerId; }
    public BigDecimal getSharePercent() { return sharePercent; }
    public OwnershipBasis getBasis() { return basis; }
    public LocalDate getFromDate() { return fromDate; }
    public LocalDate getToDate() { return toDate; }
    public void setToDate(LocalDate v) { this.toDate = v; }
    public String getRemarks() { return remarks; }
    public Instant getCreatedAt() { return createdAt; }
    public String getCreatedBy() { return createdBy; }
}