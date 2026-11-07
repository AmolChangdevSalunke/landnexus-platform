package com.landnexus.acquisition.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

/** One award line per affected parcel (the hook for compensation in Module 5). */
@Entity
@Table(name = "award_parcels")
public class AwardParcel {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "award_id", nullable = false, updatable = false) private UUID awardId;
    @Column(name = "case_parcel_id", nullable = false, updatable = false) private UUID caseParcelId;
    @Column(name = "awarded_area_ha", nullable = false, updatable = false, precision = 12, scale = 4)
    private BigDecimal awardedAreaHa;

    protected AwardParcel() { }

    public AwardParcel(UUID awardId, UUID caseParcelId, BigDecimal awardedAreaHa) {
        this.awardId = awardId;
        this.caseParcelId = caseParcelId;
        this.awardedAreaHa = awardedAreaHa;
    }

    public UUID getId() { return id; }
    public UUID getAwardId() { return awardId; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public BigDecimal getAwardedAreaHa() { return awardedAreaHa; }
}