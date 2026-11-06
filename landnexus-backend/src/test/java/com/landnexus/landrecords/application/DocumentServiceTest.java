package com.landnexus.landrecords.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.landrecords.api.dto.DocumentDtos.DocumentResponse;
import com.landnexus.landrecords.domain.LandDocument;
import com.landnexus.landrecords.domain.LandDocumentVersion;
import com.landnexus.landrecords.domain.LandParcel;
import com.landnexus.landrecords.domain.LandTypes.DocumentCategory;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.landrecords.domain.LandTypes.VerificationStatus;
import com.landnexus.landrecords.infrastructure.FileStorage;
import com.landnexus.landrecords.infrastructure.FileStorage.StoredFile;
import com.landnexus.landrecords.infrastructure.LandDocumentRepository;
import com.landnexus.landrecords.infrastructure.LandDocumentVersionRepository;
import com.landnexus.landrecords.infrastructure.LandParcelRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-05T10:00:00Z");

    @Mock private LandParcelRepository parcels;
    @Mock private LandDocumentRepository documents;
    @Mock private LandDocumentVersionRepository versions;
    @Mock private FileStorage storage;
    @Mock private LandAccess access;
    @Mock private AuditService audit;

    private DocumentService service;

    private final UUID parcelId = UUID.randomUUID();
    private final UUID docId = UUID.randomUUID();
    private final UUID uploaderId = UUID.randomUUID();
    private final CurrentActor uploader = new CurrentActor(uploaderId, "field", Set.of("FIELD_OFFICER"),
            Set.of("LAND_RECORD_READ", "DOCUMENT_READ", "DOCUMENT_UPLOAD"));
    private final CurrentActor verifier = new CurrentActor(UUID.randomUUID(), "scrutiny", Set.of("SCRUTINY_OFFICER"),
            Set.of("LAND_RECORD_READ", "DOCUMENT_READ", "DOCUMENT_VERIFY"));

    @BeforeEach
    void setUp() {
        service = new DocumentService(parcels, documents, versions, storage, new FileValidator(1024 * 1024),
                access, audit, Clock.fixed(NOW, ZoneOffset.UTC));
        LandParcel parcel = new LandParcel();
        ReflectionTestUtils.setField(parcel, "id", parcelId);
        parcel.setDistrictId(UUID.randomUUID());
        parcel.setStatus(ParcelStatus.ACTIVE);
        lenient().when(parcels.findById(parcelId)).thenReturn(Optional.of(parcel));
        lenient().when(access.canView(any(), any())).thenReturn(true);
        lenient().when(access.canViewDocuments(any(), any())).thenReturn(true);
        lenient().when(documents.saveAndFlush(any(LandDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(versions.saveAndFlush(any(LandDocumentVersion.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static UploadedFile pdf(String name) {
        byte[] bytes = "%PDF-1.4 DEMO".getBytes(StandardCharsets.US_ASCII);
        return new UploadedFile(name, "application/pdf", bytes.length, () -> new ByteArrayInputStream(bytes));
    }

    private void stubStore() throws IOException {
        when(storage.store(any())).thenReturn(new StoredFile("2026/11/k.bin", 13, "a".repeat(64)));
    }

    private LandDocument document(VerificationStatus status, int version) {
        LandDocument d = new LandDocument(parcelId, DocumentCategory.SURVEY_MAP, "DEMO map");
        ReflectionTestUtils.setField(d, "id", docId);
        d.startNewVersion(version);
        if (status != VerificationStatus.PENDING) {
            d.decide(status, UUID.randomUUID(), NOW, null);
        }
        when(documents.findById(docId)).thenReturn(Optional.of(d));
        return d;
    }

    private void stubCurrentVersion(int version) {
        when(versions.findByDocumentIdAndVersionNo(docId, version)).thenReturn(Optional.of(
                new LandDocumentVersion(docId, version, "map.pdf", "2026/11/k.bin", "application/pdf", 13,
                        "a".repeat(64), uploaderId, "field", NOW)));
    }

    @Test
    void create_validatesStoresAndRecordsVersionOneAsPending() throws IOException {
        stubStore();

        DocumentResponse response = service.create(parcelId, DocumentCategory.SURVEY_MAP, "  DEMO survey map ", pdf("map.pdf"), uploader);

        assertThat(response.title()).isEqualTo("DEMO survey map");
        assertThat(response.currentVersionNo()).isEqualTo(1);
        assertThat(response.verificationStatus()).isEqualTo(VerificationStatus.PENDING);
        assertThat(response.versions()).hasSize(1);
        assertThat(response.versions().get(0).contentType()).isEqualTo("application/pdf");
        verify(audit).record(eq("CREATE"), eq("LandDocument"), any(), anyString());
    }

    @Test
    void create_aFakePdf_isRefused_andNothingIsStored() throws IOException {
        byte[] exe = {0x4D, 0x5A, (byte) 0x90, 0};
        UploadedFile fake = new UploadedFile("evil.pdf", "application/pdf", exe.length, () -> new ByteArrayInputStream(exe));

        assertThatThrownBy(() -> service.create(parcelId, DocumentCategory.OTHER, "x", fake, uploader))
                .isInstanceOf(InvalidRequestException.class);
        verify(storage, never()).store(any());
    }

    @Test
    void create_withoutATitle_isRefused() {
        assertThatThrownBy(() -> service.create(parcelId, DocumentCategory.OTHER, " ", pdf("a.pdf"), uploader))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void create_parcelOutsideTheScope_isNotFound() {
        when(access.canView(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service.create(parcelId, DocumentCategory.OTHER, "x", pdf("a.pdf"), uploader))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void create_ifTheDatabaseFails_theStoredFileIsDeleted() throws IOException {
        stubStore();
        when(documents.saveAndFlush(any(LandDocument.class))).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> service.create(parcelId, DocumentCategory.OTHER, "x", pdf("a.pdf"), uploader))
                .isInstanceOf(IllegalStateException.class);
        verify(storage).delete("2026/11/k.bin");
    }

    @Test
    void addVersion_resetsAnEarlierVerification() throws IOException {
        LandDocument d = document(VerificationStatus.VERIFIED, 1);
        stubStore();

        DocumentResponse response = service.addVersion(docId, pdf("map-v2.pdf"), uploader);

        assertThat(response.currentVersionNo()).isEqualTo(2);
        assertThat(d.getVerificationStatus()).isEqualTo(VerificationStatus.PENDING);
        assertThat(d.getVerifiedByUserId()).isNull();
        verify(audit).record(eq("NEW_VERSION"), eq("LandDocument"), any(), anyString());
    }

    @Test
    void verify_byTheUploader_isForbidden() {
        document(VerificationStatus.PENDING, 1);
        stubCurrentVersion(1);

        assertThatThrownBy(() -> service.verify(docId, null, new CurrentActor(uploaderId, "field", Set.of(),
                Set.of("DOCUMENT_READ", "DOCUMENT_VERIFY", "LAND_RECORD_READ"))))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void verify_byAnotherPerson_marksTheCurrentVersionVerified() {
        LandDocument d = document(VerificationStatus.PENDING, 1);
        stubCurrentVersion(1);

        DocumentResponse response = service.verify(docId, "Checked against the original", verifier);

        assertThat(response.verificationStatus()).isEqualTo(VerificationStatus.VERIFIED);
        assertThat(d.getVerifiedVersionNo()).isEqualTo(1);
        assertThat(d.getVerifiedByUserId()).isEqualTo(verifier.userId());
        verify(audit).record(eq("VERIFY"), eq("LandDocument"), any(), anyString());
    }

    @Test
    void reject_needsRemarks() {
        assertThatThrownBy(() -> service.reject(docId, " ", verifier)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void reject_withRemarks_marksItRejected() {
        document(VerificationStatus.PENDING, 1);
        stubCurrentVersion(1);

        assertThat(service.reject(docId, "Unreadable scan", verifier).verificationStatus())
                .isEqualTo(VerificationStatus.REJECTED);
    }

    @Test
    void decide_onAnAlreadyDecidedDocument_isAConflict() {
        document(VerificationStatus.VERIFIED, 1);

        assertThatThrownBy(() -> service.verify(docId, null, verifier)).isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void download_isAudited_andReturnsTheStoredFile() {
        document(VerificationStatus.PENDING, 1);
        stubCurrentVersion(1);
        when(storage.load("2026/11/k.bin")).thenReturn(new ByteArrayResource(new byte[13]));

        UploadedFile.Download file = service.download(docId, 1, verifier);

        assertThat(file.filename()).isEqualTo("map.pdf");
        assertThat(file.contentType()).isEqualTo("application/pdf");
        verify(audit).record(eq("DOWNLOAD"), eq("LandDocument"), any(), anyString());
    }

    @Test
    void download_unknownVersion_isNotFound() {
        document(VerificationStatus.PENDING, 1);
        when(versions.findByDocumentIdAndVersionNo(docId, 9)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.download(docId, 9, verifier)).isInstanceOf(ResourceNotFoundException.class);
        verify(audit, never()).record(any(), any(), any(), any());
    }

    @Test
    void get_withoutDocumentAccessInScope_isNotFound() {
        document(VerificationStatus.PENDING, 1);
        when(access.canViewDocuments(any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service.get(docId, verifier)).isInstanceOf(ResourceNotFoundException.class);
    }
}