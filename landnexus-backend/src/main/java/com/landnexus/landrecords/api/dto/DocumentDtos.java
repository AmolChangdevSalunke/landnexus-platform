package com.landnexus.landrecords.api.dto;

import com.landnexus.landrecords.domain.LandDocument;
import com.landnexus.landrecords.domain.LandDocumentVersion;
import com.landnexus.landrecords.domain.LandTypes.DocumentCategory;
import com.landnexus.landrecords.domain.LandTypes.VerificationStatus;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DocumentDtos {

    private DocumentDtos() {
    }

    /** The internal storage key is deliberately not included. */
    public record DocumentVersionResponse(int versionNo, String originalFilename, String contentType, long sizeBytes,
                                          String sha256, String uploadedByUsername, Instant uploadedAt) {
        public static DocumentVersionResponse from(LandDocumentVersion v) {
            return new DocumentVersionResponse(v.getVersionNo(), v.getOriginalFilename(), v.getContentType(),
                    v.getSizeBytes(), v.getSha256(), v.getUploadedByUsername(), v.getUploadedAt());
        }
    }

    public record DocumentResponse(UUID id, UUID parcelId, DocumentCategory category, String title,
                                   int currentVersionNo, VerificationStatus verificationStatus,
                                   Integer verifiedVersionNo, UUID verifiedByUserId, Instant verifiedAt,
                                   String verificationRemarks, Instant createdAt, Instant updatedAt,
                                   List<DocumentVersionResponse> versions) {
        public static DocumentResponse from(LandDocument d, List<LandDocumentVersion> versions) {
            return new DocumentResponse(d.getId(), d.getParcelId(), d.getCategory(), d.getTitle(),
                    d.getCurrentVersionNo(), d.getVerificationStatus(), d.getVerifiedVersionNo(),
                    d.getVerifiedByUserId(), d.getVerifiedAt(), d.getVerificationRemarks(), d.getCreatedAt(),
                    d.getUpdatedAt(), versions.stream().map(DocumentVersionResponse::from).toList());
        }
    }

    /** Remarks for a verification decision. Mandatory when rejecting. */
    public record DocumentDecisionRequest(@Size(max = 500) String remarks) {
    }
}