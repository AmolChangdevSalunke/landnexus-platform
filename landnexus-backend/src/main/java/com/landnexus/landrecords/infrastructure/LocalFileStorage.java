package com.landnexus.landrecords.infrastructure;

import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/**
 * Stores files in a folder OUTSIDE the project and outside anything the web server publishes. Every file gets a
 * random name with a neutral ".bin" extension, so nothing a client sends can choose a path or become executable.
 */
@Component
public class LocalFileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalFileStorage.class);

    private final Path root;
    private final long maxBytes;

    public LocalFileStorage(@Value("${landnexus.storage.dir}") String dir,
                            @Value("${landnexus.storage.max-file-bytes:10485760}") long maxBytes) {
        if (dir == null || dir.isBlank()) {
            throw new IllegalStateException(
                    "landnexus.storage.dir is missing: set the LANDNEXUS_STORAGE_DIR environment variable");
        }
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.maxBytes = maxBytes;
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create the storage directory " + root, e);
        }
        if (!Files.isWritable(root)) {
            throw new IllegalStateException("The storage directory is not writable: " + root);
        }
    }

    @Override
    public StoredFile store(InputStream data) throws IOException {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String key = String.format("%d/%02d/%s.bin", today.getYear(), today.getMonthValue(), UUID.randomUUID());
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        MessageDigest digest = sha256();
        long total = 0;
        try (InputStream in = data; OutputStream out = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) {
                    throw new InvalidRequestException("The file is larger than " + (maxBytes / (1024 * 1024)) + " MB");
                }
                digest.update(buffer, 0, read);
                out.write(buffer, 0, read);
            }
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(target);
            throw e;
        }
        return new StoredFile(key, total, HexFormat.of().formatHex(digest.digest()));
    }

    @Override
    public Resource load(String key) {
        Path path = resolve(key);
        if (!Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("The stored file is missing");
        }
        return new FileSystemResource(path);
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            log.warn("Could not delete stored file {}", key, e);
        }
    }

    /** A key must stay inside the storage root; anything else is refused. */
    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage key");
        }
        return path;
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}