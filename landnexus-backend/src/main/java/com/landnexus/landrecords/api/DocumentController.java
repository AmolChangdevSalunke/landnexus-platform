package com.landnexus.landrecords.api;

import com.landnexus.landrecords.api.dto.DocumentDtos.DocumentDecisionRequest;
import com.landnexus.landrecords.api.dto.DocumentDtos.DocumentResponse;
import com.landnexus.landrecords.application.DocumentService;
import com.landnexus.landrecords.application.UploadedFile;
import com.landnexus.landrecords.domain.LandTypes.DocumentCategory;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Parcel documents. Downloads need the Authorization header, so a browser app must fetch them as a blob. */
@RestController
@RequestMapping("/api/v1/land-records")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('DOCUMENT_READ')")
    @GetMapping("/parcels/{parcelId}/documents")
    public List<DocumentResponse> list(@PathVariable UUID parcelId, Authentication a) {
        return service.list(parcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('DOCUMENT_UPLOAD')")
    @PostMapping(path = "/parcels/{parcelId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse upload(@PathVariable UUID parcelId, @RequestParam DocumentCategory category,
                                   @RequestParam String title, @RequestPart("file") MultipartFile file,
                                   Authentication a) {
        return service.create(parcelId, category, title, UploadedFile.of(file), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('DOCUMENT_READ')")
    @GetMapping("/documents/{id}")
    public DocumentResponse get(@PathVariable UUID id, Authentication a) {
        return service.get(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('DOCUMENT_UPLOAD')")
    @PostMapping(path = "/documents/{id}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse newVersion(@PathVariable UUID id, @RequestPart("file") MultipartFile file,
                                       Authentication a) {
        return service.addVersion(id, UploadedFile.of(file), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('DOCUMENT_READ')")
    @GetMapping("/documents/{id}/versions/{versionNo}/download")
    public ResponseEntity<Resource> download(@PathVariable UUID id, @PathVariable int versionNo, Authentication a) {
        return fileResponse(service.download(id, versionNo, CurrentActor.from(a)), false);
    }

    /**
     * Inline preview for PDF, JPEG and PNG. The browser still needs the Authorization header, so the app fetches
     * this as a blob and renders it from a short-lived object URL rather than linking to it directly.
     */
    @PreAuthorize("hasAuthority('DOCUMENT_READ')")
    @GetMapping("/documents/{id}/versions/{versionNo}/preview")
    public ResponseEntity<Resource> preview(@PathVariable UUID id, @PathVariable int versionNo, Authentication a) {
        return fileResponse(service.preview(id, versionNo, CurrentActor.from(a)), true);
    }

    /** Shared file response so download and preview keep identical security headers. */
    private static ResponseEntity<Resource> fileResponse(UploadedFile.Download file, boolean inline) {
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(file.filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(file.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(file.resource());
    }

    @PreAuthorize("hasAuthority('DOCUMENT_VERIFY')")
    @PostMapping("/documents/{id}/verify")
    public DocumentResponse verify(@PathVariable UUID id,
                                   @Valid @RequestBody(required = false) DocumentDecisionRequest request,
                                   Authentication a) {
        return service.verify(id, request == null ? null : request.remarks(), CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('DOCUMENT_VERIFY')")
    @PostMapping("/documents/{id}/reject")
    public DocumentResponse reject(@PathVariable UUID id, @Valid @RequestBody DocumentDecisionRequest request,
                                   Authentication a) {
        return service.reject(id, request.remarks(), CurrentActor.from(a));
    }
}