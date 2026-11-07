package com.landnexus.acquisition.application;

import com.landnexus.acquisition.api.dto.LifecycleDtos.AwardLine;
import com.landnexus.acquisition.api.dto.LifecycleDtos.AwardResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.DeclareAwardRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.NoticeRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.NoticeResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionDecisionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.ObjectionResponse;
import com.landnexus.acquisition.api.dto.LifecycleDtos.PossessionRequest;
import com.landnexus.acquisition.api.dto.LifecycleDtos.PossessionResponse;
import com.landnexus.acquisition.domain.AcquisitionAward;
import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.NoticeType;
import com.landnexus.acquisition.domain.AcquisitionTypes.ObjectionStatus;
import com.landnexus.acquisition.domain.AwardParcel;
import com.landnexus.acquisition.domain.CaseParcel;
import com.landnexus.acquisition.domain.CaseWorkflow;
import com.landnexus.acquisition.domain.LegalNotice;
import com.landnexus.acquisition.domain.Objection;
import com.landnexus.acquisition.domain.PossessionRecord;
import com.landnexus.acquisition.infrastructure.AcquisitionAwardRepository;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.AwardParcelRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelRepository;
import com.landnexus.acquisition.infrastructure.LegalNoticeRepository;
import com.landnexus.acquisition.infrastructure.ObjectionRepository;
import com.landnexus.acquisition.infrastructure.PossessionRecordRepository;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Notices, objections, award and possession of an acquisition case. Audit text never contains personal data. */
@Service
@Transactional(readOnly = true)
public class CaseLifecycleService {

    private static final String ENTITY = "AcquisitionCase";

    private final AcquisitionCaseRepository cases;
    private final CaseParcelRepository caseParcels;
    private final LegalNoticeRepository notices;
    private final ObjectionRepository objections;
    private final AcquisitionAwardRepository awards;
    private final AwardParcelRepository awardParcels;
    private final PossessionRecordRepository possessions;
    private final AcquisitionCaseService caseService;
    private final AdministrationLookupService admin;
    private final AcquisitionAccess access;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public CaseLifecycleService(AcquisitionCaseRepository cases, CaseParcelRepository caseParcels,
                                LegalNoticeRepository notices, ObjectionRepository objections,
                                AcquisitionAwardRepository awards, AwardParcelRepository awardParcels,
                                PossessionRecordRepository possessions, AcquisitionCaseService caseService,
                                AdministrationLookupService admin, AcquisitionAccess access,
                                NotificationService notifications, AuditService audit, Clock clock) {
        this.cases = cases;
        this.caseParcels = caseParcels;
        this.notices = notices;
        this.objections = objections;
        this.awards = awards;
        this.awardParcels = awardParcels;
        this.possessions = possessions;
        this.caseService = caseService;
        this.admin = admin;
        this.access = access;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ legal notices

    public List<NoticeResponse> listNotices(UUID caseId, CurrentActor actor) {
        view(caseId, actor);
        return notices.findByCaseIdOrderByIssuedOnAsc(caseId).stream().map(CaseLifecycleService::toResponse).toList();
    }

    @Transactional
    public NoticeResponse recordNotice(UUID caseId, NoticeRequest r, CurrentActor actor) {
        AcquisitionCase c = lock(caseId, actor);
        if (!noticeAllowed(c.getStatus(), r.noticeType())) {
            throw new InvalidTransitionException(r.noticeType() + " cannot be recorded while the case is " + c.getStatus());
        }
        if (r.noticeType() == NoticeType.PRELIMINARY_NOTIFICATION && r.objectionDeadline() == null) {
            throw new InvalidRequestException("The objection deadline is required for a preliminary notification");
        }
        if (r.objectionDeadline() != null && r.objectionDeadline().isBefore(r.issuedOn())) {
            throw new InvalidRequestException("The objection deadline cannot be before the issue date");
        }
        if (r.issuedOn().isAfter(LocalDate.now(clock))) {
            throw new InvalidRequestException("The issue date cannot be in the future");
        }
        String reference = r.referenceNumber().trim();
        if (notices.existsByCaseIdAndReferenceNumber(caseId, reference)) {
            throw new DuplicateResourceException("A notice with reference " + reference + " already exists for this case");
        }
        LegalNotice saved = notices.saveAndFlush(new LegalNotice(caseId, r.noticeType(), reference, r.issuedOn(),
                r.objectionDeadline(), blankToNull(r.description())));
        audit.record("RECORD_NOTICE", ENTITY, caseId, "type=" + saved.getNoticeType() + ", reference=" + reference
                + ", issuedOn=" + saved.getIssuedOn() + ", objectionDeadline=" + saved.getObjectionDeadline());
        return toResponse(saved);
    }

    private static boolean noticeAllowed(CaseStatus status, NoticeType type) {
        return switch (type) {
            case PRELIMINARY_NOTIFICATION -> status == CaseStatus.VERIFICATION_COMPLETE;
            case FINAL_DECLARATION -> status == CaseStatus.READY_FOR_AWARD;
            case AWARD_NOTICE -> status == CaseStatus.AWARD_DECLARED;
            case POSSESSION_NOTICE -> status == CaseStatus.AWARD_DECLARED || status == CaseStatus.POSSESSION_TAKEN;
            case OTHER -> status != CaseStatus.CANCELLED && status != CaseStatus.CLOSED;
        };
    }

    // ------------------------------------------------------------------ objections

    /** The objector reference is personal data: showing it is audited, so this is read-write. */
    @Transactional
    public List<ObjectionResponse> listObjections(UUID caseId, CurrentActor actor) {
        view(caseId, actor);
        boolean show = actor.hasAuthority("LANDOWNER_READ");
        List<Objection> rows = objections.findByCaseIdOrderByObjectionNumberAsc(caseId);
        if (show && !rows.isEmpty()) {
            audit.record("VIEW_OBJECTIONS", ENTITY, caseId, "objections were viewed with objector references");
        }
        return rows.stream().map(o -> toResponse(o, show)).toList();
    }

    @Transactional
    public ObjectionResponse registerObjection(UUID caseId, ObjectionRequest r, CurrentActor actor) {
        AcquisitionCase c = lock(caseId, actor);
        if (c.getStatus() != CaseStatus.NOTIFICATION_ISSUED) {
            throw new InvalidTransitionException("Objections can be registered only while the case is NOTIFICATION_ISSUED");
        }
        LegalNotice notice = notices.findFirstByCaseIdAndNoticeTypeOrderByIssuedOnDesc(caseId, NoticeType.PRELIMINARY_NOTIFICATION)
                .orElseThrow(() -> new InvalidRequestException("There is no preliminary notification for this case"));
        if (r.receivedOn().isBefore(notice.getIssuedOn()) || r.receivedOn().isAfter(notice.getObjectionDeadline())) {
            throw new InvalidRequestException("The objection was received outside the objection period ("
                    + notice.getIssuedOn() + " to " + notice.getObjectionDeadline() + ")");
        }
        caseParcels.findById(r.caseParcelId())
                .filter(p -> p.getCaseId().equals(caseId) && p.getReleasedAt() == null)
                .orElseThrow(() -> new InvalidRequestException("Unknown affected parcel: " + r.caseParcelId()));
        String number = String.format("OBJ-%03d", objections.countByCaseId(caseId) + 1);
        Objection saved = objections.saveAndFlush(new Objection(caseId, r.caseParcelId(), number, r.receivedOn(),
                r.grounds().trim(), blankToNull(r.objectorReference()), actor.userId()));
        for (UserRef authority : admin.findUsersByRoleWithDistrictAccess("COMPETENT_AUTHORITY", c.getDistrictId())) {
            notifications.notify(authority.id(), "ACQUISITION", "Objection awaiting review",
                    "Objection " + number + " was registered for case " + c.getCaseNumber() + ".", ENTITY, caseId);
        }
        audit.record("REGISTER_OBJECTION", ENTITY, caseId, "objection=" + number + ", caseParcelId=" + r.caseParcelId());
        return toResponse(saved, true);
    }

    @Transactional
    public ObjectionResponse decideObjection(UUID caseId, UUID objectionId, ObjectionDecisionRequest r, CurrentActor actor) {
        AcquisitionCase c = lock(caseId, actor);
        if (c.getStatus() != CaseStatus.NOTIFICATION_ISSUED) {
            throw new InvalidTransitionException("Objections can be reviewed only while the case is NOTIFICATION_ISSUED");
        }
        if (r.outcome() == ObjectionStatus.OPEN) {
            throw new InvalidRequestException("The outcome must be ACCEPTED or DISMISSED");
        }
        Objection o = objections.findById(objectionId).filter(x -> x.getCaseId().equals(caseId))
                .orElseThrow(() -> new ResourceNotFoundException("Objection not found: " + objectionId));
        if (o.getStatus() != ObjectionStatus.OPEN) {
            throw new InvalidTransitionException("This objection has already been decided");
        }
        if (actor.userId().equals(o.getRegisteredByUserId())) {
            throw new AccessDeniedException("The person who registered an objection cannot decide it");
        }
        o.decide(r.outcome(), actor.userId(), clock.instant(), r.remarks().trim());
        Objection saved = objections.saveAndFlush(o);
        notifications.notify(o.getRegisteredByUserId(), "ACQUISITION", "Objection decided",
                "Objection " + o.getObjectionNumber() + " of case " + c.getCaseNumber() + " was " + r.outcome().name().toLowerCase() + ".",
                ENTITY, caseId);
        audit.record("DECIDE_OBJECTION", ENTITY, caseId, "objection=" + o.getObjectionNumber() + ", outcome=" + r.outcome());
        return toResponse(saved, actor.hasAuthority("LANDOWNER_READ"));
    }

    // ------------------------------------------------------------------ award

    public AwardResponse getAward(UUID caseId, CurrentActor actor) {
        view(caseId, actor);
        AcquisitionAward award = awards.findByCaseId(caseId)
                .orElseThrow(() -> new ResourceNotFoundException("No award has been declared for this case"));
        return toResponse(award);
    }

    /** Moves the case to AWARD_DECLARED and records the award with one line per affected parcel, in one transaction. */
    @Transactional
    public AwardResponse declareAward(UUID caseId, DeclareAwardRequest r, CurrentActor actor) {
        caseService.transition(caseId, CaseWorkflow.DECLARE_AWARD, null, actor);
        LegalNotice notice = notices.findFirstByCaseIdAndNoticeTypeOrderByIssuedOnDesc(caseId, NoticeType.PRELIMINARY_NOTIFICATION)
                .orElseThrow(() -> new InvalidRequestException("There is no preliminary notification for this case"));
        if (r.awardDate().isBefore(notice.getObjectionDeadline())) {
            throw new InvalidRequestException("The award date cannot be before the end of the objection period ("
                    + notice.getObjectionDeadline() + ")");
        }
        if (awards.existsByCaseId(caseId)) {
            throw new DuplicateResourceException("An award has already been declared for this case");
        }
        AcquisitionAward award = awards.saveAndFlush(new AcquisitionAward(caseId, r.awardNumber().trim(), r.awardDate(),
                blankToNull(r.remarks()), actor.userId()));
        for (CaseParcel p : caseParcels.findByCaseIdAndReleasedAtIsNullOrderByIdentifiedAtAsc(caseId)) {
            awardParcels.save(new AwardParcel(award.getId(), p.getId(), p.getAreaToAcquireHa()));
        }
        audit.record("DECLARE_AWARD", ENTITY, caseId, "award=" + award.getAwardNumber() + ", date=" + award.getAwardDate());
        return toResponse(award);
    }

    // ------------------------------------------------------------------ possession

    public List<PossessionResponse> listPossessions(UUID caseId, CurrentActor actor) {
        view(caseId, actor);
        return possessions.findByCaseIdOrderByPossessionDateAsc(caseId).stream().map(CaseLifecycleService::toResponse).toList();
    }

    @Transactional
    public PossessionResponse recordPossession(UUID caseId, PossessionRequest r, CurrentActor actor) {
        AcquisitionCase c = lock(caseId, actor);
        if (c.getStatus() != CaseStatus.AWARD_DECLARED) {
            throw new InvalidTransitionException("Possession can be recorded only while the case is AWARD_DECLARED");
        }
        caseParcels.findById(r.caseParcelId())
                .filter(p -> p.getCaseId().equals(caseId) && p.getReleasedAt() == null)
                .orElseThrow(() -> new InvalidRequestException("Unknown affected parcel: " + r.caseParcelId()));
        AcquisitionAward award = awards.findByCaseId(caseId)
                .orElseThrow(() -> new InvalidRequestException("No award has been declared for this case"));
        if (r.possessionDate().isBefore(award.getAwardDate())) {
            throw new InvalidRequestException("Possession cannot be taken before the award date (" + award.getAwardDate() + ")");
        }
        if (possessions.existsByCaseParcelId(r.caseParcelId())) {
            throw new DuplicateResourceException("Possession of this parcel has already been recorded");
        }
        PossessionRecord saved = possessions.saveAndFlush(new PossessionRecord(caseId, r.caseParcelId(), r.possessionDate(),
                r.possessionType(), blankToNull(r.remarks()), actor.userId()));
        audit.record("RECORD_POSSESSION", ENTITY, caseId, "caseParcelId=" + r.caseParcelId() + ", date=" + r.possessionDate()
                + ", type=" + r.possessionType());
        return toResponse(saved);
    }

    // ------------------------------------------------------------------ helpers

    private AcquisitionCase view(UUID caseId, CurrentActor actor) {
        return cases.findById(caseId).filter(c -> access.canView(actor, c.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Case not found: " + caseId));
    }

    private AcquisitionCase lock(UUID caseId, CurrentActor actor) {
        return cases.findByIdForUpdate(caseId).filter(c -> access.canView(actor, c.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Case not found: " + caseId));
    }

    private AwardResponse toResponse(AcquisitionAward a) {
        List<AwardLine> lines = awardParcels.findByAwardId(a.getId()).stream().map(l -> new AwardLine(l.getCaseParcelId(),
                caseParcels.findById(l.getCaseParcelId()).map(CaseParcel::getParcelId).orElse(null), l.getAwardedAreaHa())).toList();
        return new AwardResponse(a.getId(), a.getCaseId(), a.getAwardNumber(), a.getAwardDate(), a.getRemarks(),
                a.getDeclaredByUserId(), lines);
    }

    private static NoticeResponse toResponse(LegalNotice n) {
        return new NoticeResponse(n.getId(), n.getCaseId(), n.getNoticeType(), n.getReferenceNumber(), n.getIssuedOn(),
                n.getObjectionDeadline(), n.getDescription(), n.getCreatedBy());
    }

    private static ObjectionResponse toResponse(Objection o, boolean showReference) {
        return new ObjectionResponse(o.getId(), o.getCaseId(), o.getCaseParcelId(), o.getObjectionNumber(), o.getReceivedOn(),
                o.getGrounds(), showReference ? o.getObjectorReference() : null, o.getStatus(), o.getRegisteredByUserId(),
                o.getDecidedByUserId(), o.getDecidedAt(), o.getDecisionRemarks());
    }

    private static PossessionResponse toResponse(PossessionRecord p) {
        return new PossessionResponse(p.getId(), p.getCaseId(), p.getCaseParcelId(), p.getPossessionDate(),
                p.getPossessionType(), p.getRemarks(), p.getRecordedByUserId());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}