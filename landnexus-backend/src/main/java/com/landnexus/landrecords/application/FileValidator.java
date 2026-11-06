package com.landnexus.landrecords.application;

import com.landnexus.shared.exception.InvalidRequestException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Accepts only PDF, JPEG and PNG and decides the type from the file's own first bytes, not from the name or the
 * header the browser sent. The extension and the declared content type must agree with what the bytes say.
 * (No virus scanner in this prototype; see the limits at the end of this message.)
 */
@Component
public class FileValidator {

    public record ValidatedFile(String contentType, String safeFilename) {
    }

    private static final String PDF = "application/pdf";
    private static final String JPEG = "image/jpeg";
    private static final String PNG = "image/png";
    private static final Map<String, Set<String>> EXTENSIONS =
            Map.of(PDF, Set.of("pdf"), JPEG, Set.of("jpg", "jpeg"), PNG, Set.of("png"));

    private final long maxBytes;

    public FileValidator(@Value("${landnexus.storage.max-file-bytes:10485760}") long maxBytes) {
        this.maxBytes = maxBytes;
    }

    public ValidatedFile validate(String originalFilename, String declaredContentType, byte[] head, long size) {
        if (size <= 0) {
            throw new InvalidRequestException("The file is empty");
        }
        if (size > maxBytes) {
            throw new InvalidRequestException("The file is larger than " + (maxBytes / (1024 * 1024)) + " MB");
        }
        String safeName = sanitize(originalFilename);
        String detected = detectType(head);
        if (detected == null) {
            throw new InvalidRequestException("Only PDF, JPEG and PNG files are accepted: the file content is not one of these");
        }
        if (!EXTENSIONS.get(detected).contains(extension(safeName))) {
            throw new InvalidRequestException("The file extension does not match the file content");
        }
        if (declaredContentType != null && !declaredContentType.isBlank()) {
            String declared = declaredContentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
            if (!declared.equals("application/octet-stream") && !declared.equals(detected)) {
                throw new InvalidRequestException("The declared content type does not match the file content");
            }
        }
        return new ValidatedFile(detected, safeName);
    }

    static String detectType(byte[] head) {
        if (head == null) {
            return null;
        }
        if (head.length >= 5 && head[0] == 0x25 && head[1] == 0x50 && head[2] == 0x44 && head[3] == 0x46 && head[4] == 0x2D) {
            return PDF;
        }
        if (head.length >= 3 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return JPEG;
        }
        if (head.length >= 8 && (head[0] & 0xFF) == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47
                && head[4] == 0x0D && head[5] == 0x0A && head[6] == 0x1A && head[7] == 0x0A) {
            return PNG;
        }
        return null;
    }

    /** Keeps only the last path segment and harmless characters, so the name is safe to store and to show. */
    static String sanitize(String original) {
        String name = original == null ? "" : original;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        name = name.substring(slash + 1).replaceAll("[^A-Za-z0-9 ._()-]", "_").trim();
        if (name.length() > 120) {
            name = name.substring(name.length() - 120);
        }
        return name.isBlank() ? "document" : name;
    }

    private static String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}