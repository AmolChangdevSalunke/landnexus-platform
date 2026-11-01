package com.landnexus.administration.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "villages")
public class Village extends AdministrativeEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "taluka_id", nullable = false)
    private Taluka taluka;

    public Taluka getTaluka() { return taluka; }
    public void setTaluka(Taluka taluka) { this.taluka = taluka; }
}
