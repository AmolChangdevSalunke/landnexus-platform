package com.landnexus.landrecords.application;

import com.landnexus.landrecords.api.dto.DocumentDtos.DocumentResponse;
import com.landnexus.landrecords.application.FileValidator.ValidatedFile;
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
import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Supporting documents: validated uploads, versions, human verification and audited downloads.
 * Verification is a manual decision by a person other than the one who uploaded the current version.
 */
@Service
@Transactional(readOnly = true)
public class DocumentService {

    private static final String ENTITY = "LandDocument";
    private static final int HEAD_BYTES = 16;

    private final LandParcelRepository parcels;
    private final LandDocumentRepository documents;
    private final LandDocumentVersionRepository versions;
    private final FileStorage storage;
    private final FileValidator validator;
    private final LandAccess access;
    private final AuditService audit;
    private final Clock clock;

    public DocumentService(LandParcelRepository parcels, LandDocumentRepository documents,
                           LandDocumentVersionRepository versions, FileStorage storage, FileValidator validator,
                           LandAccess access, AuditService audit, Clock clock) {
        this.parcels = parcels;
        this.documents = documents;
        this.versions = versions;
        this.storage = storage;
        this.validator = validator;
        this.access = access;
        this.audit = audit;
        this.clock = clock;
    }

    public List<DocumentResponse> list(UUID parcelId, CurrentActor actor) {
        LandParcel parcel = loadParcel(parcelId);
        requireDocumentAccess(actor, parcel);
        return documents.findByParcelIdOrderByCreatedAtDesc(parcelId).stream().map(this::toResponse).toList();
    }

    public DocumentResponse get(UUID documentId, CurrentActor actor) {
        return toResponse(loadDocument(documentId, actor));
    }

    /** Every download is audited, so this is a read-write transaction. */
    @Transactional
    public UploadedFile.Download download(UUID documentId, int versionNo, CurrentActor actor) {
        LandDocument document = loadDocument(documentId, actor);
        LandDocumentVersion version = versions.findByDocumentIdAndVersionNo(document.getId(), versionNo)
                .orElseThrow(() -> new ResourceNotFoundException("Version " + versionNo + " of the document was not found"));
        audit.record("DOWNLOAD", ENTITY, document.getId(), "version=" + versionNo + ", sha256=" + version.getSha256());
        return new UploadedFile.Download(storage.load(version.getStoredKey()), version.getOriginalFilename(),
                version.getContentType(), version.getSizeBytes());
    }

    @Transactional
    public DocumentResponse create(UUID parcelId, DocumentCategory category, String title, UploadedFile file,
                                   CurrentActor actor) {
        String cleanTitle = requireTitle(title);
        LandParcel parcel = loadParcel(parcelId);
        requireWriteScope(actor, parcel);
        ValidatedFile validated = validate(file);

        Instant now = clock.instant();
        StoredFile stored = store(file);
        try {
            LandDocument document = new LandDocument(parcelId, category, cleanTitle);
            document.startNewVersion(1);
            LandDocument saved = documents.saveAndFlush(document);
            LandDocumentVersion version = versions.saveAndFlush(newVersion(saved.getId(), 1, validated, stored, actor, now));
            audit.record("CREATE", ENTITY, saved.getId(), "category=" + category + ", version=1, size=" + stored.size()
                    + ", sha256=" + stored.sha256());
            return DocumentResponse.from(saved, List.of(version));
        } catch (RuntimeException e) {
            storage.delete(stored.key());
            throw e;
        }
    }

    @Transactional
    public DocumentResponse addVersion(UUID documentId, UploadedFile file, CurrentActor actor) {
        LandDocument document = documents.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));
        LandParcel parcel = loadParcel(document.getParcelId());
        requireWriteScope(actor, parcel);
        ValidatedFile validated = validate(file);

        int next = document.getCurrentVersionNo() + 1;
        Instant now = clock.instant();
        StoredFile stored = store(file);
        try {
            document.startNewVersion(next);
            LandDocument saved = documents.saveAndFlush(document);
            versions.saveAndFlush(newVersion(saved.getId(), next, validated, stored, actor, now));
            audit.record("NEW_VERSION", ENTITY, saved.getId(), "version=" + next + ", size=" + stored.size()
                    + ", sha256=" + stored.sha256());
            return toResponse(saved);
        } catch (RuntimeException e) {
            storage.delete(stored.key());
            throw e;
        }
    }

    @Transactional
    public DocumentResponse verify(UUID documentId, String remarks, CurrentActor actor) {
        return decide(documentId, VerificationStatus.VERIFIED, blankToNull(remarks), actor);
    }

    @Transactional
    public DocumentResponse reject(UUID documentId, String remarks, CurrentActor actor) {
        String reason = blankToNull(remarks);
        if (reason == null) {
            throw new InvalidRequestException("Remarks are required when rejecting a document");
        }
        return decide(documentId, VerificationStatus.REJECTED, reason, actor);
    }

    private DocumentResponse decide(UUID documentId, VerificationStatus outcome, String remarks, CurrentActor actor) {
        LandDocument document = loadDocument(documentId, actor);
        if (document.getVerificationStatus() != VerificationStatus.PENDING) {
            throw new InvalidTransitionException("Only a document that is pending verification can be verified or rejected");
        }
        LandDocumentVersion current = versions.findByDocumentIdAndVersionNo(document.getId(), document.getCurrentVersionNo())
                .orElseThrow(() -> new ResourceNotFoundException("The current version of the document was not found"));
        if (actor.userId().equals(current.getUploadedByUserId())) {
            throw new AccessDeniedException("The person who uploaded the current version cannot verify or reject it");
        }
        document.decide(outcome, actor.userId(), clock.instant(), remarks);
        LandDocument saved = documents.saveAndFlush(document);
        audit.record(outcome == VerificationStatus.VERIFIED ? "VERIFY" : "REJECT_DOCUMENT", ENTITY, saved.getId(),
                "version=" + saved.getCurrentVersionNo() + (remarks == null ? "" : ", remarks=" + remarks));
        return toResponse(saved);
    }

    // ------------------------------------------------------------------ helpers

    private LandDocument loadDocument(UUID documentId, CurrentActor actor) {
        LandDocument document = documents.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));
        requireDocumentAccess(actor, loadParcel(document.getParcelId()));
        return document;
    }

    private LandParcel loadParcel(UUID parcelId) {
        return parcels.findById(parcelId).orElseThrow(() -> new ResourceNotFoundException("Parcel not found: " + parcelId));
    }

    /** Read access = DOCUMENT_READ + geographic scope; otherwise "not found". */
    private void requireDocumentAccess(CurrentActor actor, LandParcel parcel) {
        if (!access.canViewDocuments(actor, parcel.getDistrictId())) {
            throw new ResourceNotFoundException("Document not found");
        }
    }

    /** The controller already checked DOCUMENT_UPLOAD; here the parcel must be in the caller's scope and active. */
    private void requireWriteScope(CurrentActor actor, LandParcel parcel) {
        if (!access.canView(actor, parcel.getDistrictId())) {
            throw new ResourceNotFoundException("Parcel not found: " + parcel.getId());
        }
        if (parcel.getStatus() != ParcelStatus.ACTIVE) {
            throw new InvalidTransitionException("An inactive parcel cannot be changed; activate it first");
        }
    }

    private ValidatedFile validate(UploadedFile file) {
        if (file == null) {
            throw new InvalidRequestException("A file is required");
        }
        byte[] head = new byte[HEAD_BYTES];
        int read;
        try (InputStream in = file.content().open()) {
            read = in.readNBytes(head, 0, HEAD_BYTES);
        } catch (IOException e) {
            throw new InvalidRequestException("The uploaded file could not be read");
        }
        return validator.validate(file.filename(), file.contentType(), Arrays.copyOf(head, read), file.size());
    }

    private StoredFile store(UploadedFile file) {
        try {
            return storage.store(file.content().open());
        } catch (IOException e) {
            throw new IllegalStateException("The file could not be stored", e);
        }
    }

    private static LandDocumentVersion newVersion(UUID documentId, int versionNo, ValidatedFile validated,
                                                  StoredFile stored, CurrentActor actor, Instant now) {
        return new LandDocumentVersion(documentId, versionNo, validated.safeFilename(), stored.key(),
                validated.contentType(), stored.size(), stored.sha256(), actor.userId(), actor.username(), now);
    }

    private DocumentResponse toResponse(LandDocument document) {
        return DocumentResponse.from(document, versions.findByDocumentIdOrderByVersionNoAsc(document.getId()));
    }

    private static String requireTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new InvalidRequestException("A title is required");
        }
        if (title.trim().length() > 200) {
            throw new InvalidRequestException("The title is too long (maximum 200 characters)");
        }
        return title.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}