package com.landnexus.gis.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.VillageDetailRef;
import com.landnexus.gis.api.dto.GisDtos.AlignmentResponse;
import com.landnexus.gis.api.dto.GisDtos.AlignmentVersion;
import com.landnexus.gis.api.dto.GisDtos.BoundaryResponse;
import com.landnexus.gis.api.dto.GisDtos.BoundaryVersion;
import com.landnexus.gis.infrastructure.GisRepository;
import com.landnexus.gis.infrastructure.GisRepository.Inspection;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.landrecords.application.LandRecordsLookupService.ParcelRef;
import com.landnexus.projects.application.ProjectLookupService;
import com.landnexus.projects.application.ProjectLookupService.ProjectRef;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Parcel boundaries and project alignments. The geometry is entered by officers as GeoJSON; PostGIS checks it, and
 * nothing is invented or fetched from outside. A changed geometry becomes a new version.
 */
@Service
@Transactional(readOnly = true)
public class GisService {

    static final int MAX_CHARS = 1_000_000;
    static final int MAX_PARCEL_POINTS = 5_000;
    static final int MAX_ALIGNMENT_POINTS = 50_000;
    static final BigDecimal MIN_AREA_HA = new BigDecimal("0.0001");
    // Rough bounding box of India: catches swapped or mistyped coordinates, it is not a border test.
    static final double MIN_LAT = 6.0;
    static final double MAX_LAT = 37.6;
    static final double MIN_LON = 68.0;
    static final double MAX_LON = 97.5;

    private final GisRepository repo;
    private final LandRecordsLookupService land;
    private final ProjectLookupService projects;
    private final AdministrationLookupService admin;
    private final GisAccess access;
    private final AuditService audit;

    public GisService(GisRepository repo, LandRecordsLookupService land, ProjectLookupService projects,
                      AdministrationLookupService admin, GisAccess access, AuditService audit) {
        this.repo = repo;
        this.land = land;
        this.projects = projects;
        this.admin = admin;
        this.access = access;
        this.audit = audit;
    }

    // ------------------------------------------------------------------ parcel boundaries

    @Transactional
    public BoundaryResponse setParcelBoundary(UUID parcelId, String geoJson, String sourceNote, CurrentActor actor) {
        ParcelRef parcel = visibleParcel(parcelId, actor);
        if (!parcel.active()) {
            throw new InvalidTransitionException("An inactive parcel cannot be changed; activate it first");
        }
        Inspection in = inspect(geoJson, Set.of("POLYGON", "MULTIPOLYGON"), MAX_PARCEL_POINTS, "a Polygon or MultiPolygon");
        if (in.areaHa() == null || in.areaHa().compareTo(MIN_AREA_HA) < 0) {
            throw new InvalidRequestException("The boundary is too small (less than 1 square metre)");
        }
        BigDecimal area;
        int version;
        try {
            repo.supersedeBoundary(parcelId);
            version = repo.nextBoundaryVersion(parcelId);
            area = repo.insertBoundary(parcelId, version, geoJson, blankToNull(sourceNote), actor.userId(), actor.username());
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateResourceException("The boundary was changed at the same moment by someone else; try again");
        }
        BigDecimal variance = area.subtract(parcel.areaHa()).multiply(new BigDecimal("100"))
                .divide(parcel.areaHa(), 2, RoundingMode.HALF_UP);
        audit.record("SET_BOUNDARY", "LandParcel", parcelId, "version=" + version + ", areaHa=" + area
                + ", recordedAreaHa=" + parcel.areaHa() + ", vertices=" + in.points());
        return new BoundaryResponse(parcelId, version, area, parcel.areaHa(), variance, in.points());
    }

    public String parcelBoundaryFeature(UUID parcelId, CurrentActor actor) {
        visibleParcel(parcelId, actor);
        return repo.currentBoundaryFeature(parcelId)
                .orElseThrow(() -> new ResourceNotFoundException("No boundary has been recorded for this parcel"));
    }

    public List<BoundaryVersion> parcelBoundaryHistory(UUID parcelId, CurrentActor actor) {
        visibleParcel(parcelId, actor);
        return repo.boundaryVersions(parcelId).stream().map(v -> new BoundaryVersion(v.versionNo(), v.measure(), v.vertices(),
                v.sourceNote(), v.enteredBy(), v.enteredAt(), v.current())).toList();
    }

    /** The current boundaries of a village's parcels as one FeatureCollection (properties: parcelId, versionNo, areaHa). */
    public String villageParcelsFeatureCollection(UUID villageId, CurrentActor actor) {
        VillageDetailRef village = admin.findActiveVillageDetail(villageId).filter(v -> access.canView(actor, v.districtId()))
                .orElseThrow(() -> new ResourceNotFoundException("Village not found: " + villageId));
        return repo.parcelsFeatureCollection(land.parcelIdsInVillage(village.id()));
    }

    // ------------------------------------------------------------------ project alignments

    @Transactional
    public AlignmentResponse setAlignment(UUID projectId, String geoJson, int corridorWidthM, String sourceNote, CurrentActor actor) {
        ProjectRef project = visibleProject(projectId, actor);
        if (corridorWidthM < 1 || corridorWidthM > 1000) {
            throw new InvalidRequestException("The corridor width must be between 1 and 1000 metres");
        }
        Inspection in = inspect(geoJson, Set.of("LINESTRING", "MULTILINESTRING"), MAX_ALIGNMENT_POINTS, "a LineString or MultiLineString");
        if (in.lengthKm() == null || in.lengthKm().signum() <= 0) {
            throw new InvalidRequestException("The alignment has no length");
        }
        BigDecimal length;
        int version;
        try {
            repo.supersedeAlignment(projectId);
            version = repo.nextAlignmentVersion(projectId);
            length = repo.insertAlignment(projectId, version, geoJson, corridorWidthM, blankToNull(sourceNote), actor.userId(), actor.username());
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateResourceException("The alignment was changed at the same moment by someone else; try again");
        }
        audit.record("SET_ALIGNMENT", "Project", projectId, "project=" + project.code() + ", version=" + version
                + ", lengthKm=" + length + ", corridorWidthM=" + corridorWidthM + ", vertices=" + in.points());
        return new AlignmentResponse(projectId, version, length, corridorWidthM, in.points());
    }

    public String alignmentFeature(UUID projectId, CurrentActor actor) {
        visibleProject(projectId, actor);
        return repo.currentAlignmentFeature(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("No alignment has been recorded for this project"));
    }

    public String corridorFeature(UUID projectId, CurrentActor actor) {
        visibleProject(projectId, actor);
        return repo.currentCorridorFeature(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("No alignment has been recorded for this project"));
    }

    public List<AlignmentVersion> alignmentHistory(UUID projectId, CurrentActor actor) {
        visibleProject(projectId, actor);
        return repo.alignmentVersions(projectId).stream().map(v -> new AlignmentVersion(v.versionNo(), v.measure(),
                v.corridorWidthM(), v.vertices(), v.sourceNote(), v.enteredBy(), v.enteredAt(), v.current())).toList();
    }

    // ------------------------------------------------------------------ helpers

    private ParcelRef visibleParcel(UUID parcelId, CurrentActor actor) {
        return land.findParcel(parcelId).filter(p -> access.canView(actor, p.districtId()))
                .orElseThrow(() -> new ResourceNotFoundException("Parcel not found: " + parcelId));
    }

    private ProjectRef visibleProject(UUID projectId, CurrentActor actor) {
        return projects.findActiveProject(projectId).filter(p -> access.canView(actor, p.districtId()))
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
    }

    private Inspection inspect(String geoJson, Set<String> allowed, int maxPoints, String expected) {
        if (geoJson == null || geoJson.isBlank()) {
            throw new InvalidRequestException("The GeoJSON geometry is required in the request body");
        }
        if (geoJson.length() > MAX_CHARS) {
            throw new InvalidRequestException("The GeoJSON is too large (maximum " + MAX_CHARS + " characters)");
        }
        Inspection in;
        try {
            in = repo.inspect(geoJson);
        } catch (DataAccessException e) {
            throw new InvalidRequestException("The body is not a valid GeoJSON geometry");
        }
        if (in.type() == null || !allowed.contains(in.type())) {
            throw new InvalidRequestException("The geometry must be " + expected + (in.type() == null ? "" : ", not " + in.type()));
        }
        if (in.coordDim() != 2) {
            throw new InvalidRequestException("Elevation (Z) or measure values are not accepted: use [longitude, latitude] only");
        }
        if (!in.valid()) {
            throw new InvalidRequestException("The geometry is not valid: " + in.reason());
        }
        if (in.points() > maxPoints) {
            throw new InvalidRequestException("The geometry has too many points (" + in.points() + "; maximum " + maxPoints + ")");
        }
        if (in.xMin() < MIN_LON || in.xMax() > MAX_LON || in.yMin() < MIN_LAT || in.yMax() > MAX_LAT) {
            throw new InvalidRequestException("Coordinates must be [longitude, latitude] inside India: check that they are not swapped");
        }
        return in;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}