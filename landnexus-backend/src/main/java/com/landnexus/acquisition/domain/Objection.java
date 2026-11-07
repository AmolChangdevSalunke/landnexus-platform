package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.ObjectionStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** An objection to the acquisition of a parcel. Sensitive: the objector reference is masked without LANDOWNER_READ. */
@Entity
@Table(name = "objections")
@EntityListeners(AuditingEntityListener.class)
public class Objection {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false) private UUID caseId;
    @Column(name = "case_parcel_id", nullable = false, updatable = false) private UUID caseParcelId;
    @Column(name = "objection_number", nullable = false, length = 20, updatable = false) private String objectionNumber;
    @Column(name = "received_on", nullable = false, updatable = false) private LocalDate receivedOn;
    @Column(name = "grounds", nullable = false, length = 2000, updatable = false) private String grounds;
    @Column(name = "objector_reference", length = 200, updatable = false) private String objectorReference;
    @Enumerated(EnumType.STRING) @Column(name = "status", nullable = false, length = 20)
    private ObjectionStatus status = ObjectionStatus.OPEN;
    @Column(name = "registered_by_user_id", nullable = false, updatable = false) private UUID registeredByUserId;
    @Column(name = "decided_by_user_id") private UUID decidedByUserId;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "decision_remarks", length = 1000) private String decisionRemarks;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected Objection() { }

    public Objection(UUID caseId, UUID caseParcelId, String objectionNumber, LocalDate receivedOn, String grounds,
                     String objectorReference, UUID registeredByUserId) {
        this.caseId = caseId;
        this.caseParcelId = caseParcelId;
        this.objectionNumber = objectionNumber;
        this.receivedOn = receivedOn;
        this.grounds = grounds;
        this.objectorReference = objectorReference;
        this.registeredByUserId = registeredByUserId;
    }

    public void decide(ObjectionStatus outcome, UUID userId, Instant at, String remarks) {
        this.status = outcome;
        this.decidedByUserId = userId;
        this.decidedAt = at;
        this.decisionRemarks = remarks;
    }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public UUID getCaseParcelId() { return caseParcelId; }
    public String getObjectionNumber() { return objectionNumber; }
    public LocalDate getReceivedOn() { return receivedOn; }
    public String getGrounds() { return grounds; }
    public String getObjectorReference() { return objectorReference; }
    public ObjectionStatus getStatus() { return status; }
    public UUID getRegisteredByUserId() { return registeredByUserId; }
    public UUID getDecidedByUserId() { return decidedByUserId; }
    public Instant getDecidedAt() { return decidedAt; }
    public String getDecisionRemarks() { return decisionRemarks; }
}