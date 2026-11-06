package com.landnexus.landrecords.application;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

/** An uploaded file as the services see it, independent of the web framework. */
public record UploadedFile(String filename, String contentType, long size, ContentSupplier content) {

    @FunctionalInterface
    public interface ContentSupplier {
        InputStream open() throws IOException;
    }

    public static UploadedFile of(MultipartFile file) {
        return new UploadedFile(file.getOriginalFilename(), file.getContentType(), file.getSize(), file::getInputStream);
    }

    public record Download(Resource resource, String filename, String contentType, long size) {
    }
}