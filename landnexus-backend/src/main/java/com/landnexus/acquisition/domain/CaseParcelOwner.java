package com.landnexus.acquisition.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

/** An owner and share as they were when the parcel was identified (a snapshot; ids only). */
@Entity
@Table(name = "case_parcel_owners")
public class CaseParcelOwner {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_parcel_id", nullable = false, updatable = false)
    private UUID caseParcelId;
    @Column(name = "landowner_id", nullable = false, updatable = false)
    private UUID landownerId;
    @Column(name = "share_percent", nullable = false, updatable = false, precision = 5, scale = 2)
    private BigDecimal sharePercent;

    protected CaseParcelOwner() { }

    public CaseParcelOwner(UUID caseParcelId, UUID landownerId, BigDecimal sharePercent) {
        this.caseParcelId = caseParcelId;
        this.landownerId = landownerId;
        this.sharePercent = sharePercent;
    }

    public UUID getId() { return id; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public UUID getLandownerId() { return landownerId; }
    public BigDecimal getSharePercent() { return sharePercent; }
}