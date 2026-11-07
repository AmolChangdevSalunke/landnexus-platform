package com.landnexus.acquisition.application;

import com.landnexus.acquisition.api.dto.LifecycleDtos.PhotoResponse;
import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.SurveyStatus;
import com.landnexus.acquisition.domain.FieldSurvey;
import com.landnexus.acquisition.domain.SurveyPhoto;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.FieldSurveyRepository;
import com.landnexus.acquisition.infrastructure.SurveyPhotoRepository;
import com.landnexus.landrecords.application.FileValidator;
import com.landnexus.landrecords.application.FileValidator.ValidatedFile;
import com.landnexus.landrecords.application.UploadedFile;
import com.landnexus.landrecords.infrastructure.FileStorage;
import com.landnexus.landrecords.infrastructure.FileStorage.StoredFile;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Geo-tagged photos of a surveyed parcel: JPEG or PNG only, at most 10 per survey, uploaded by the assigned surveyor. */
@Service
@Transactional(readOnly = true)
public class SurveyPhotoService {

    static final int MAX_PHOTOS = 10;

    private final AcquisitionCaseRepository cases;
    private final FieldSurveyRepository surveys;
    private final SurveyPhotoRepository photos;
    private final FileStorage storage;
    private final FileValidator validator;
    private final AcquisitionAccess access;
    private final AuditService audit;
    private final Clock clock;

    public SurveyPhotoService(AcquisitionCaseRepository cases, FieldSurveyRepository surveys, SurveyPhotoRepository photos,
                              FileStorage storage, FileValidator validator, AcquisitionAccess access, AuditService audit,
                              Clock clock) {
        this.cases = cases;
        this.surveys = surveys;
        this.photos = photos;
        this.storage = storage;
        this.validator = validator;
        this.access = access;
        this.audit = audit;
        this.clock = clock;
    }

    public List<PhotoResponse> list(UUID caseId, UUID surveyId, CurrentActor actor) {
        loadSurvey(caseId, surveyId, actor);
        return photos.findBySurveyIdOrderByUploadedAtAsc(surveyId).stream().map(SurveyPhotoService::toResponse).toList();
    }

    /** Every download is audited, so this is a read-write transaction. */
    @Transactional
    public UploadedFile.Download download(UUID caseId, UUID surveyId, UUID photoId, CurrentActor actor) {
        loadSurvey(caseId, surveyId, actor);
        SurveyPhoto p = photos.findByIdAndSurveyId(photoId, surveyId)
                .orElseThrow(() -> new ResourceNotFoundException("Photo not found: " + photoId));
        audit.record("DOWNLOAD_PHOTO", "AcquisitionCase", caseId, "surveyId=" + surveyId + ", photoId=" + photoId);
        return new UploadedFile.Download(storage.load(p.getStoredKey()), p.getOriginalFilename(), p.getContentType(), p.getSizeBytes());
    }

    @Transactional
    public PhotoResponse upload(UUID caseId, UUID surveyId, UploadedFile file, BigDecimal latitude, BigDecimal longitude,
                                Instant capturedAt, CurrentActor actor) {
        AcquisitionCase c = access(caseId, actor);
        FieldSurvey survey = surveys.findById(surveyId).filter(s -> s.getCaseId().equals(caseId))
                .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + surveyId));
        if (c.getStatus() != CaseStatus.SURVEY_IN_PROGRESS || survey.getStatus() != SurveyStatus.SUBMITTED) {
            throw new InvalidTransitionException("Photos can be added only to a survey that is awaiting verification");
        }
        if (!actor.userId().equals(survey.getSurveyorUserId())) {
            throw new AccessDeniedException("Only the surveyor of this survey can add photos");
        }
        if (photos.countBySurveyId(surveyId) >= MAX_PHOTOS) {
            throw new InvalidRequestException("A survey can have at most " + MAX_PHOTOS + " photos");
        }
        if (latitude.compareTo(SurveyService.MIN_LAT) < 0 || latitude.compareTo(SurveyService.MAX_LAT) > 0
                || longitude.compareTo(SurveyService.MIN_LON) < 0 || longitude.compareTo(SurveyService.MAX_LON) > 0) {
            throw new InvalidRequestException("The GPS point is outside India: check that latitude and longitude are not swapped");
        }
        Instant now = clock.instant();
        if (capturedAt != null && capturedAt.isAfter(now.plus(Duration.ofMinutes(5)))) {
            throw new InvalidRequestException("The capture time is in the future");
        }
        ValidatedFile validated = validate(file);
        if (!validated.contentType().startsWith("image/")) {
            throw new InvalidRequestException("Photos must be JPEG or PNG images");
        }
        StoredFile stored = store(file);
        try {
            SurveyPhoto saved = photos.saveAndFlush(new SurveyPhoto(surveyId, validated.safeFilename(), stored.key(),
                    validated.contentType(), stored.size(), stored.sha256(), latitude, longitude, capturedAt,
                    actor.userId(), actor.username(), now));
            audit.record("ADD_PHOTO", "AcquisitionCase", caseId, "surveyId=" + surveyId + ", size=" + stored.size()
                    + ", sha256=" + stored.sha256());
            return toResponse(saved);
        } catch (RuntimeException e) {
            storage.delete(stored.key());
            throw e;
        }
    }

    private FieldSurvey loadSurvey(UUID caseId, UUID surveyId, CurrentActor actor) {
        access(caseId, actor);
        return surveys.findById(surveyId).filter(s -> s.getCaseId().equals(caseId))
                .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + surveyId));
    }

    private AcquisitionCase access(UUID caseId, CurrentActor actor) {
        return cases.findById(caseId).filter(c -> access.canView(actor, c.getDistrictId()))
                .orElseThrow(() -> new ResourceNotFoundException("Case not found: " + caseId));
    }

    private ValidatedFile validate(UploadedFile file) {
        if (file == null) {
            throw new InvalidRequestException("A file is required");
        }
        byte[] head = new byte[16];
        int read;
        try (InputStream in = file.content().open()) {
            read = in.readNBytes(head, 0, head.length);
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

    private static PhotoResponse toResponse(SurveyPhoto p) {
        return new PhotoResponse(p.getId(), p.getSurveyId(), p.getOriginalFilename(), p.getContentType(), p.getSizeBytes(),
                p.getSha256(), p.getGpsLatitude(), p.getGpsLongitude(), p.getCapturedAt(), p.getUploadedByUsername(),
                p.getUploadedAt());
    }
}