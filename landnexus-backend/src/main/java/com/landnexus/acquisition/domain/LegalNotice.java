package com.landnexus.acquisition.domain;

import com.landnexus.acquisition.domain.AcquisitionTypes.NoticeType;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A legal notice (gazette, public notice, award notice...) recorded against a case. Never edited. */
@Entity
@Table(name = "legal_notices")
@EntityListeners(AuditingEntityListener.class)
public class LegalNotice {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "case_id", nullable = false, updatable = false) private UUID caseId;
    @Enumerated(EnumType.STRING) @Column(name = "notice_type", nullable = false, length = 30, updatable = false)
    private NoticeType noticeType;
    @Column(name = "reference_number", nullable = false, length = 60, updatable = false) private String referenceNumber;
    @Column(name = "issued_on", nullable = false, updatable = false) private LocalDate issuedOn;
    @Column(name = "objection_deadline", updatable = false) private LocalDate objectionDeadline;
    @Column(name = "description", length = 1000, updatable = false) private String description;
    @CreatedBy @Column(name = "created_by", length = 100, updatable = false) private String createdBy;

    protected LegalNotice() { }

    public LegalNotice(UUID caseId, NoticeType noticeType, String referenceNumber, LocalDate issuedOn,
                       LocalDate objectionDeadline, String description) {
        this.caseId = caseId;
        this.noticeType = noticeType;
        this.referenceNumber = referenceNumber;
        this.issuedOn = issuedOn;
        this.objectionDeadline = objectionDeadline;
        this.description = description;
    }

    public UUID getId() { return id; }
    public UUID getCaseId() { return caseId; }
    public NoticeType getNoticeType() { return noticeType; }
    public String getReferenceNumber() { return referenceNumber; }
    public LocalDate getIssuedOn() { return issuedOn; }
    public LocalDate getObjectionDeadline() { return objectionDeadline; }
    public String getDescription() { return description; }
    public String getCreatedBy() { return createdBy; }
}