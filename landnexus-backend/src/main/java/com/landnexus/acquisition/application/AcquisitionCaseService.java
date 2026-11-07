package com.landnexus.acquisition.application;

import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseParcelResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.CaseResponse;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.HistoryEntry;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.OwnerShareDto;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.ParcelIdentifyRequest;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.ParcelReportRow;
import com.landnexus.acquisition.api.dto.AcquisitionDtos.VerificationReport;
import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.SurveyStatus;
import com.landnexus.acquisition.domain.CaseParcel;
import com.landnexus.acquisition.domain.CaseParcelOwner;
import com.landnexus.acquisition.domain.CaseStatusHistory;
import com.landnexus.acquisition.domain.CaseWorkflow;
import com.landnexus.acquisition.domain.FieldSurvey;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelOwnerRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelRepository;
import com.landnexus.acquisition.infrastructure.CaseStatusHistoryRepository;
import com.landnexus.acquisition.infrastructure.FieldSurveyRepository;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.landrecords.application.LandRecordsLookupService.OwnerShareRef;
import com.landnexus.landrecords.application.LandRecordsLookupService.ParcelRef;
import com.landnexus.projects.application.ProjectLookupService;
import com.landnexus.projects.application.ProjectLookupService.ProjectRef;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import com.landnexus.shared.workflow.Transition;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The acquisition case: creation, affected villages and parcels, surveyor assignment, stage changes and reports. */
@Service
@Transactional(readOnly = true)
public class AcquisitionCaseService {

    private static final String ENTITY = "AcquisitionCase";

    private final AcquisitionCaseRepository cases;
    private final CaseParcelRepository caseParcels;
    private final CaseParcelOwnerRepository owners;
    private final FieldSurveyRepository surveys;
    private final CaseStatusHistoryRepository history;
    private final ProjectLookupService projects;
    private final LandRecordsLookupService land;
    private final AdministrationLookupService admin;
    private final GeoScopeService geoScope;
    private final AcquisitionAccess access;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public AcquisitionCaseService(AcquisitionCaseRepository cases, CaseParcelRepository caseParcels,
                                  CaseParcelOwnerRepository owners, FieldSurveyRepository surveys,
                                  CaseStatusHistoryRepository history, ProjectLookupService projects,
                                  LandRecordsLookupService land, AdministrationLookupService admin,
                                  GeoScopeService geoScope, AcquisitionAccess access,
                                  NotificationService notifications, AuditService audit, Clock clock) {
        this.cases = cases;
        this.caseParcels = caseParcels;
        this.owners = owners;
        this.surveys = surveys;
        this.history = history;
        this.projects = projects;
        this.land = land;
        this.admin = admin;
        this.geoScope = geoScope;
        this.access = access;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ queries

    public CaseResponse get(UUID id, CurrentActor actor) {
        return toResponse(loadVisible(id, actor), actor);
    }

    public PageResponse<CaseResponse> list(CaseStatus status, UUID districtId, UUID projectId, int page, int size,
                                           CurrentActor actor) {
        Specification<AcquisitionCase> spec = access.visibleTo(actor);
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (districtId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("districtId"), districtId));
        }
        if (projectId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("projectId"), projectId));
        }
        Page<AcquisitionCase> result = cases.findAll(spec, PageParams.ofDescending(page, size, "createdAt"));
        return PageResponse.from(result, c -> toResponse(c, actor));
    }

    public List<HistoryEntry> history(UUID id, CurrentActor actor) {
        loadVisible(id, actor);
        return history.findByCaseIdOrderByOccurredAtAsc(id).stream().map(HistoryEntry::from).toList();
    }

    public List<CaseParcelResponse> listParcels(UUID caseId, CurrentActor actor) {
        loadVisible(caseId, actor);
        List<CaseParcel> rows = caseParcels.findByCaseIdAndReleasedAtIsNullOrderByIdentifiedAtAsc(caseId);
        Map<UUID, List<CaseParcelOwner>> byParcel = ownersOf(rows);
        Map<UUID, SurveyStatus> latest = latestSurveyStatus(caseId);
        return rows.stream().map(p -> toParcelResponse(p, byParcel.getOrDefault(p.getId(), List.of()), latest.get(p.getId()))).toList();
    }

    /** The case parcels assigned to the caller (for the field officer's worklist), only while a survey is running. */
    public List<CaseParcelResponse> myAssignments(CurrentActor actor) {
        List<CaseParcelResponse> result = new ArrayList<>();
        for (CaseParcel p : caseParcels.findByAssignedSurveyorUserIdAndReleasedAtIsNull(actor.userId())) {
            AcquisitionCase c = cases.findById(p.getCaseId()).orElse(null);
            if (c != null && c.getStatus() == CaseStatus.SURVEY_IN_PROGRESS && access.canView(actor, c.getDistrictId())) {
                result.add(toParcelResponse(p, List.of(), latestSurveyStatus(c.getId()).get(p.getId())));
            }
        }
        return result;
    }

    /** Per parcel: recorded area, area to acquire, the live survey, variance, GPS point and who verified it. */
    public VerificationReport verificationReport(UUID caseId, CurrentActor actor) {
        AcquisitionCase c = loadVisible(caseId, actor);
        List<CaseParcel> rows = caseParcels.findByCaseIdAndReleasedAtIsNullOrderByIdentifiedAtAsc(caseId);
        Map<UUID, List<FieldSurvey>> byParcel = surveys.findByCaseIdOrderByCreatedAtAsc(caseId).stream()
                .collect(Collectors.groupingBy(FieldSurvey::getCaseParcelId));
        List<ParcelReportRow> report = new ArrayList<>();
        int verified = 0;
        int awaiting = 0;
        int rejectedOnly = 0;
        int notSurveyed = 0;
        BigDecimal total = BigDecimal.ZERO;
        for (CaseParcel p : rows) {
            total = total.add(p.getAreaToAcquireHa());
            List<FieldSurvey> list = byParcel.getOrDefault(p.getId(), List.of());
            FieldSurvey live = list.stream().filter(s -> s.getStatus() != SurveyStatus.REJECTED).findFirst().orElse(null);
            BigDecimal recorded = land.findParcel(p.getParcelId()).map(ParcelRef::areaHa).orElse(null);
            if (live == null) {
                if (list.isEmpty()) {
                    notSurveyed++;
                } else {
                    rejectedOnly++;
                }
                report.add(new ParcelReportRow(p.getId(), p.getParcelId(), recorded, p.getAreaToAcquireHa(),
                        list.isEmpty() ? "NOT_SURVEYED" : "REJECTED_ONLY", null, null, null, null, null, null));
                continue;
            }
            boolean ok = live.getStatus() == SurveyStatus.VERIFIED;
            if (ok) {
                verified++;
            } else {
                awaiting++;
            }
            report.add(new ParcelReportRow(p.getId(), p.getParcelId(), recorded, p.getAreaToAcquireHa(),
                    ok ? "VERIFIED" : "AWAITING_VERIFICATION", live.getMeasuredAreaHa(), live.getVariancePercent(),
                    live.getGpsLatitude(), live.getGpsLongitude(), live.getSurveyorUsername(), live.getVerifiedAt()));
        }
        return new VerificationReport(c.getId(), c.getCaseNumber(), c.getStatus(), rows.size(), verified, awaiting,
                rejectedOnly, notSurveyed, total, report);
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public CaseResponse create(CaseRequest request, CurrentActor actor) {
        ProjectRef project = projects.findActiveProject(request.projectId())
                .orElseThrow(() -> new InvalidRequestException("Unknown or inactive project: " + request.projectId()));
        geoScope.requireDistrictAccess(actor, project.districtId());

        // Take the number FIRST: a native query flushes pending changes, so nothing may be half-changed yet.
        Long sequence = cases.nextNumber();
        AcquisitionCase c = new AcquisitionCase();
        c.setCaseNumber(String.format("ACQ-%d-%06d", Year.now(clock).getValue(), sequence));
        c.setProjectId(project.id());
        c.setStateId(project.stateId());
        c.setDistrictId(project.districtId());
        c.setFramework(request.framework());
        c.setFrameworkNote(blankToNull(request.frameworkNote()));
        c.setDescription(blankToNull(request.description()));
        c.setStatus(CaseStatus.INITIATED);
        AcquisitionCase saved = cases.saveAndFlush(c);
        history.save(new CaseStatusHistory(saved.getId(), null, CaseStatus.INITIATED, "CREATE", actor.userId(),
                actor.username(), null, clock.instant()));
        audit.record("CREATE", ENTITY, saved.getId(), "case=" + saved.getCaseNumber() + ", project=" + project.code()
                + ", framework=" + saved.getFramework());
        return toResponse(saved, actor);
    }

    @Transactional
    public CaseResponse setVillages(UUID caseId, Set<UUID> villageIds, CurrentActor actor) {
        AcquisitionCase c = lockVisible(caseId, actor);
        requireStatus(c, CaseStatus.INITIATED);
        ProjectRef project = projects.findActiveProject(c.getProjectId())
                .orElseThrow(() -> new InvalidRequestException("The project of this case is no longer active"));
        if (!project.villageIds().containsAll(villageIds)) {
            throw new InvalidRequestException("Affected villages must be among the villages of the approved project");
        }
        Set<UUID> removed = c.getVillageIds().stream().filter(v -> !villageIds.contains(v)).collect(Collectors.toSet());
        if (!removed.isEmpty() && caseParcels.existsByCaseIdAndVillageIdIn(caseId, removed)) {
            throw new InvalidRequestException("A village that already has identified parcels cannot be removed");
        }
        c.getVillageIds().clear();
        c.getVillageIds().addAll(villageIds);
        AcquisitionCase saved = cases.saveAndFlush(c);
        audit.record("SET_VILLAGES", ENTITY, caseId, "villages=" + new java.util.TreeSet<>(villageIds));
        return toResponse(saved, actor);
    }

    @Transactional
    public CaseParcelResponse identifyParcel(UUID caseId, ParcelIdentifyRequest request, CurrentActor actor) {
        AcquisitionCase c = lockVisible(caseId, actor);
        if (c.getStatus() != CaseStatus.INITIATED && c.getStatus() != CaseStatus.SURVEY_IN_PROGRESS) {
            throw new InvalidTransitionException("Parcels can be identified only before the survey is completed");
        }
        ParcelRef parcel = land.findParcel(request.parcelId())
                .filter(ParcelRef::active)
                .orElseThrow(() -> new InvalidRequestException("Unknown or inactive parcel: " + request.parcelId()));
        if (!c.getVillageIds().contains(parcel.villageId())) {
            throw new InvalidRequestException("The parcel's village is not an identified affected village of this case");
        }
        if (!parcel.districtId().equals(c.getDistrictId())) {
            throw new InvalidRequestException("The parcel belongs to another district than the case");
        }
        if (request.areaToAcquireHa().compareTo(parcel.areaHa()) > 0) {
            throw new InvalidRequestException("The area to acquire cannot exceed the parcel's recorded area ("
                    + parcel.areaHa().stripTrailingZeros().toPlainString() + " ha)");
        }
        if (caseParcels.existsByCaseIdAndParcelId(caseId, parcel.id())) {
            throw new DuplicateResourceException("The parcel is already identified in this case");
        }
        if (caseParcels.existsByParcelIdAndReleasedAtIsNull(parcel.id())) {
            throw new DuplicateResourceException("The parcel is already part of another open acquisition case");
        }
        CaseParcel saved = caseParcels.saveAndFlush(
                new CaseParcel(caseId, parcel.id(), parcel.villageId(), request.areaToAcquireHa()));
        List<CaseParcelOwner> snapshot = new ArrayList<>();
        for (OwnerShareRef o : land.currentOwners(parcel.id())) {
            snapshot.add(owners.save(new CaseParcelOwner(saved.getId(), o.landownerId(), o.sharePercent())));
        }
        audit.record("IDENTIFY_PARCEL", ENTITY, caseId, "parcelId=" + parcel.id() + ", areaToAcquireHa="
                + request.areaToAcquireHa() + ", owners=" + snapshot.size());
        return toParcelResponse(saved, snapshot, null);
    }

    @Transactional
    public void removeParcel(UUID caseId, UUID caseParcelId, CurrentActor actor) {
        AcquisitionCase c = lockVisible(caseId, actor);
        requireStatus(c, CaseStatus.INITIATED);
        CaseParcel p = findCaseParcel(caseId, caseParcelId);
        if (surveys.existsByCaseParcelId(p.getId())) {
            throw new InvalidTransitionException("A parcel that has been surveyed cannot be removed");
        }
        owners.deleteByCaseParcelId(p.getId());
        caseParcels.delete(p);
        caseParcels.flush();
        audit.record("REMOVE_PARCEL", ENTITY, caseId, "parcelId=" + p.getParcelId());
    }

    @Transactional
    public CaseParcelResponse assignSurveyor(UUID caseId, UUID caseParcelId, UUID surveyorUserId, CurrentActor actor) {
        AcquisitionCase c = lockVisible(caseId, actor);
        if (c.getStatus() != CaseStatus.INITIATED && c.getStatus() != CaseStatus.SURVEY_IN_PROGRESS) {
            throw new InvalidTransitionException("A surveyor can be assigned only before the survey is completed");
        }
        CaseParcel p = findCaseParcel(caseId, caseParcelId);
        boolean eligible = admin.findUsersByRoleWithDistrictAccess("FIELD_OFFICER", c.getDistrictId()).stream()
                .map(UserRef::id).anyMatch(surveyorUserId::equals);
        if (!eligible) {
            throw new InvalidRequestException("The surveyor must be an enabled field officer with access to the case's district");
        }
        if (surveys.findFirstByCaseParcelIdAndStatusIn(p.getId(), List.of(SurveyStatus.SUBMITTED, SurveyStatus.VERIFIED)).isPresent()) {
            throw new InvalidTransitionException("The parcel already has a live survey");
        }
        p.setAssignedSurveyorUserId(surveyorUserId);
        CaseParcel saved = caseParcels.saveAndFlush(p);
        notifications.notify(surveyorUserId, "ACQUISITION", "Survey assigned",
                "A parcel of case " + c.getCaseNumber() + " was assigned to you for survey.", ENTITY, caseId);
        audit.record("ASSIGN_SURVEYOR", ENTITY, caseId, "caseParcelId=" + caseParcelId + ", surveyorUserId=" + surveyorUserId);
        return toParcelResponse(saved, List.of(), null);
    }

    @Transactional
    public CaseResponse transition(UUID caseId, String action, String reason, CurrentActor actor) {
        AcquisitionCase c = lockVisible(caseId, actor);
        Transition<CaseStatus> transition =
                CaseWorkflow.DEFINITION.require(c.getStatus(), action, actor.authorities(), reason);
        Instant now = clock.instant();
        long parcelCount = caseParcels.countByCaseIdAndReleasedAtIsNull(caseId);

        if (CaseWorkflow.START_SURVEY.equals(action) && parcelCount == 0) {
            throw new InvalidRequestException("Identify at least one affected parcel before starting the survey");
        }
        if (CaseWorkflow.COMPLETE_VERIFICATION.equals(action)) {
            long verified = surveys.countParcelsWithStatus(caseId, SurveyStatus.VERIFIED);
            if (verified < parcelCount) {
                throw new InvalidRequestException((parcelCount - verified) + " affected parcel(s) still have no verified survey");
            }
        }
        CaseStatus from = c.getStatus();
        c.setStatus(transition.to());
        AcquisitionCase saved = cases.saveAndFlush(c);
        if (CaseWorkflow.CANCEL.equals(action)) {
            caseParcels.releaseAll(caseId, now);
        }
        history.save(new CaseStatusHistory(caseId, from, transition.to(), action, actor.userId(), actor.username(),
                blankToNull(reason), now));
        audit.record(action, ENTITY, caseId, "status: " + from + " -> " + transition.to()
                + (blankToNull(reason) == null ? "" : ", reason: " + reason));
        return toResponse(saved, actor);
    }

    // ------------------------------------------------------------------ helpers

    private AcquisitionCase loadVisible(UUID id, CurrentActor actor) {
        AcquisitionCase c = cases.findById(id).orElseThrow(() -> new ResourceNotFoundException("Case not found: " + id));
        return requireView(c, actor);
    }

    private AcquisitionCase lockVisible(UUID id, CurrentActor actor) {
        AcquisitionCase c = cases.findByIdForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Case not found: " + id));
        return requireView(c, actor);
    }

    private AcquisitionCase requireView(AcquisitionCase c, CurrentActor actor) {
        if (!access.canView(actor, c.getDistrictId())) {
            throw new ResourceNotFoundException("Case not found: " + c.getId());
        }
        return c;
    }

    private static void requireStatus(AcquisitionCase c, CaseStatus expected) {
        if (c.getStatus() != expected) {
            throw new InvalidTransitionException("This is only possible while the case is " + expected);
        }
    }

    private CaseParcel findCaseParcel(UUID caseId, UUID caseParcelId) {
        return caseParcels.findById(caseParcelId)
                .filter(p -> p.getCaseId().equals(caseId) && p.getReleasedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Affected parcel not found: " + caseParcelId));
    }

    private Map<UUID, List<CaseParcelOwner>> ownersOf(List<CaseParcel> rows) {
        if (rows.isEmpty()) {
            return Map.of();
        }
        return owners.findByCaseParcelIdIn(rows.stream().map(CaseParcel::getId).toList()).stream()
                .collect(Collectors.groupingBy(CaseParcelOwner::getCaseParcelId));
    }

    /** VERIFIED beats SUBMITTED beats REJECTED when a parcel has several surveys. */
    private Map<UUID, SurveyStatus> latestSurveyStatus(UUID caseId) {
        Map<UUID, SurveyStatus> result = new HashMap<>();
        for (FieldSurvey s : surveys.findByCaseIdOrderByCreatedAtAsc(caseId)) {
            result.merge(s.getCaseParcelId(), s.getStatus(),
                    (a, b) -> a == SurveyStatus.REJECTED ? b : (b == SurveyStatus.REJECTED ? a : (a == SurveyStatus.VERIFIED ? a : b)));
        }
        return result;
    }

    private CaseResponse toResponse(AcquisitionCase c, CurrentActor actor) {
        List<String> actions = CaseWorkflow.DEFINITION.from(c.getStatus()).stream()
                .filter(t -> actor.hasAuthority(t.requiredAuthority()))
                .map(Transition::action)
                .sorted(Comparator.naturalOrder())
                .toList();
        return CaseResponse.from(c, actions);
    }

    private static CaseParcelResponse toParcelResponse(CaseParcel p, List<CaseParcelOwner> ownerRows, SurveyStatus status) {
        return new CaseParcelResponse(p.getId(), p.getCaseId(), p.getParcelId(), p.getVillageId(), p.getAreaToAcquireHa(),
                p.getAssignedSurveyorUserId(), status,
                ownerRows.stream().map(o -> new OwnerShareDto(o.getLandownerId(), o.getSharePercent())).toList(),
                p.getIdentifiedAt());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}