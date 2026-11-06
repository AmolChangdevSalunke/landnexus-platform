package com.landnexus.landrecords.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.landrecords.application.FileValidator.ValidatedFile;
import com.landnexus.shared.exception.InvalidRequestException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class FileValidatorTest {

    private final FileValidator validator = new FileValidator(1024);

    private static final byte[] PDF = "%PDF-1.4 demo".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
    private static final byte[] EXE = {0x4D, 0x5A, (byte) 0x90, 0};

    @Test
    void acceptsRealPdfJpegAndPng() {
        assertThat(validator.validate("deed.pdf", "application/pdf", PDF, 100).contentType()).isEqualTo("application/pdf");
        assertThat(validator.validate("photo.JPG", "image/jpeg", JPEG, 100).contentType()).isEqualTo("image/jpeg");
        assertThat(validator.validate("map.png", "image/png", PNG, 100).contentType()).isEqualTo("image/png");
    }

    @Test
    void decidesFromTheBytes_notFromTheName() {
        assertThatThrownBy(() -> validator.validate("evil.pdf", "application/pdf", EXE, 100))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> validator.validate("notes.pdf", "application/pdf", "hello".getBytes(), 5))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void extensionMustMatchTheContent() {
        assertThatThrownBy(() -> validator.validate("picture.pdf", "image/png", PNG, 100))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> validator.validate("deed.exe", "application/pdf", PDF, 100))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> validator.validate("noextension", "application/pdf", PDF, 100))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void declaredContentTypeMustMatch_butOctetStreamIsTolerated() {
        assertThatThrownBy(() -> validator.validate("deed.pdf", "image/png", PDF, 100))
                .isInstanceOf(InvalidRequestException.class);
        assertThat(validator.validate("deed.pdf", "application/octet-stream", PDF, 100).contentType())
                .isEqualTo("application/pdf");
        assertThat(validator.validate("deed.pdf", null, PDF, 100).contentType()).isEqualTo("application/pdf");
    }

    @Test
    void emptyAndOversizedFilesAreRefused() {
        assertThatThrownBy(() -> validator.validate("a.pdf", "application/pdf", PDF, 0))
                .isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> validator.validate("a.pdf", "application/pdf", PDF, 2000))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("larger");
    }

    @Test
    void filenamesAreSanitised() {
        ValidatedFile v = validator.validate("..\\..\\secret/<script>deed (1).pdf", "application/pdf", PDF, 100);

        assertThat(v.safeFilename()).doesNotContain("/").doesNotContain("\\").doesNotContain("<");
        assertThat(v.safeFilename()).endsWith(".pdf");
        assertThat(FileValidator.sanitize(null)).isEqualTo("document");
        assertThat(FileValidator.sanitize("a".repeat(300) + ".pdf")).hasSizeLessThanOrEqualTo(120);
    }
}