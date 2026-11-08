package com.landnexus.gis.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.gis.api.dto.GisDtos.AlignmentResponse;
import com.landnexus.gis.api.dto.GisDtos.BoundaryResponse;
import com.landnexus.gis.infrastructure.GisRepository;
import com.landnexus.gis.infrastructure.GisRepository.Inspection;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.landrecords.application.LandRecordsLookupService.ParcelRef;
import com.landnexus.projects.application.ProjectLookupService;
import com.landnexus.projects.application.ProjectLookupService.ProjectRef;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GisServiceTest {

    @Mock private GisRepository repo;
    @Mock private LandRecordsLookupService land;
    @Mock private ProjectLookupService projects;
    @Mock private AdministrationLookupService admin;
    @Mock private GisAccess access;
    @Mock private AuditService audit;

    private GisService service;
    private final UUID parcelId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final CurrentActor officer = new CurrentActor(UUID.randomUUID(), "field", Set.of("FIELD_OFFICER"), Set.of("GIS_READ", "GIS_WRITE"));

    @BeforeEach
    void setUp() {
        service = new GisService(repo, land, projects, admin, access, audit);
        lenient().when(access.canView(any(), any())).thenReturn(true);
        lenient().when(land.findParcel(parcelId)).thenReturn(Optional.of(new ParcelRef(parcelId, UUID.randomUUID(), districtId, new BigDecimal("1.2"), true)));
        lenient().when(projects.findActiveProject(projectId)).thenReturn(Optional.of(
                new ProjectRef(projectId, "PRJ-1", "T", UUID.randomUUID(), districtId, Set.of())));
    }

    private static Inspection polygon(boolean valid, String type, int dim, int points, double x, double y) {
        return new Inspection(valid, valid ? "Valid Geometry" : "Self-intersection[75.3 19.8]", type, dim, points, x, x + 0.001, y, y + 0.001,
                valid ? new BigDecimal("1.1590") : null, valid ? new BigDecimal("0.470") : null);
    }

    private void stubInspection(Inspection in) {
        when(repo.inspect(anyString())).thenReturn(in);
    }

    @Test
    void boundary_isStored_andTheVarianceAgainstTheRecordedAreaIsReported() {
        stubInspection(polygon(true, "POLYGON", 2, 5, 75.34, 19.87));
        when(repo.nextBoundaryVersion(parcelId)).thenReturn(2);
        when(repo.insertBoundary(eq(parcelId), eq(2), anyString(), any(), any(), anyString())).thenReturn(new BigDecimal("1.1590"));

        BoundaryResponse r = service.setParcelBoundary(parcelId, "{\"type\":\"Polygon\"}", " DEMO survey ", officer);

        assertThat(r.versionNo()).isEqualTo(2);
        assertThat(r.variancePercent()).isEqualByComparingTo("-3.42");
        verify(repo).supersedeBoundary(parcelId);
        verify(audit).record(eq("SET_BOUNDARY"), eq("LandParcel"), eq(parcelId), anyString());
    }

    @Test
    void aSelfIntersectingShape_isRefused_withPostGisReason() {
        stubInspection(polygon(false, "POLYGON", 2, 5, 75.34, 19.87));

        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "{}", null, officer))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("Self-intersection");
        verify(repo, never()).insertBoundary(any(), anyInt(), any(), any(), any(), any());
    }

    @Test
    void aWrongGeometryTypeForTheThing_isRefused() {
        stubInspection(polygon(true, "LINESTRING", 2, 3, 75.34, 19.87));
        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "{}", null, officer))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("Polygon");

        stubInspection(polygon(true, "POLYGON", 2, 5, 75.34, 19.87));
        assertThatThrownBy(() -> service.setAlignment(projectId, "{}", 60, null, officer))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("LineString");
    }

    @Test
    void swappedOrOutOfIndiaCoordinates_areRefused() {
        stubInspection(polygon(true, "POLYGON", 2, 5, 19.87, 75.34));

        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "{}", null, officer))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("inside India");
    }

    @Test
    void elevationValuesAndTooManyPoints_areRefused() {
        stubInspection(polygon(true, "POLYGON", 3, 5, 75.34, 19.87));
        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "{}", null, officer)).hasMessageContaining("Elevation");

        stubInspection(polygon(true, "POLYGON", 2, GisService.MAX_PARCEL_POINTS + 1, 75.34, 19.87));
        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "{}", null, officer)).hasMessageContaining("too many points");
    }

    @Test
    void emptyOrHugeBodies_areRefusedBeforeTheDatabaseSeesThem() {
        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, " ", null, officer)).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "x".repeat(GisService.MAX_CHARS + 1), null, officer))
                .isInstanceOf(InvalidRequestException.class);
        verify(repo, never()).inspect(any());
    }

    @Test
    void parcelOutsideTheScope_isNotFound_andAnInactiveOneIsAConflict() {
        when(access.canView(any(), any())).thenReturn(false);
        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "{}", null, officer)).isInstanceOf(ResourceNotFoundException.class);

        when(access.canView(any(), any())).thenReturn(true);
        when(land.findParcel(parcelId)).thenReturn(Optional.of(new ParcelRef(parcelId, UUID.randomUUID(), districtId, BigDecimal.ONE, false)));
        assertThatThrownBy(() -> service.setParcelBoundary(parcelId, "{}", null, officer)).isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void alignment_needsAReasonableCorridorWidth_andStoresTheLength() {
        assertThatThrownBy(() -> service.setAlignment(projectId, "{}", 0, null, officer)).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> service.setAlignment(projectId, "{}", 1001, null, officer)).isInstanceOf(InvalidRequestException.class);

        stubInspection(polygon(true, "LINESTRING", 2, 3, 75.30, 19.80));
        when(repo.nextAlignmentVersion(projectId)).thenReturn(1);
        when(repo.insertAlignment(eq(projectId), eq(1), anyString(), eq(60), any(), any(), anyString())).thenReturn(new BigDecimal("15.200"));

        AlignmentResponse r = service.setAlignment(projectId, "{}", 60, "DEMO", officer);

        assertThat(r.lengthKm()).isEqualByComparingTo("15.2");
        verify(audit).record(eq("SET_ALIGNMENT"), eq("Project"), eq(projectId), anyString());
    }

    private static int anyInt() {
        return org.mockito.ArgumentMatchers.anyInt();
    }
}