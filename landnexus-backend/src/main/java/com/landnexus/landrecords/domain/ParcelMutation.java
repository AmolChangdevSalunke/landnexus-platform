package com.landnexus.landrecords.domain;

import com.landnexus.landrecords.domain.LandTypes.MutationType;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A mutation (change of record) entry typed in by an officer. Never edited: a correction is a new entry. */
@Entity
@Table(name = "parcel_mutations")
@EntityListeners(AuditingEntityListener.class)
public class ParcelMutation {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "parcel_id", nullable = false, updatable = false)
    private UUID parcelId;
    @Column(name = "mutation_number", nullable = false, length = 30, updatable = false)
    private String mutationNumber;
    @Column(name = "mutation_date", nullable = false, updatable = false)
    private LocalDate mutationDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "mutation_type", nullable = false, length = 20, updatable = false)
    private MutationType mutationType;

    @Column(name = "description", length = 1000, updatable = false)
    private String description;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @CreatedBy
    @Column(name = "created_by", length = 100, updatable = false)
    private String createdBy;

    protected ParcelMutation() { }

    public ParcelMutation(UUID parcelId, String mutationNumber, LocalDate mutationDate, MutationType mutationType,
                          String description) {
        this.parcelId = parcelId;
        this.mutationNumber = mutationNumber;
        this.mutationDate = mutationDate;
        this.mutationType = mutationType;
        this.description = description;
    }

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }

    public UUID getId() { return id; }
    public UUID getParcelId() { return parcelId; }
    public String getMutationNumber() { return mutationNumber; }
    public LocalDate getMutationDate() { return mutationDate; }
    public MutationType getMutationType() { return mutationType; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
    public String getCreatedBy() { return createdBy; }
}