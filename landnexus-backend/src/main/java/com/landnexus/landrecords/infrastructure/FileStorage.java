package com.landnexus.landrecords.infrastructure;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.Resource;

/** Where uploaded files live. Today a local folder; another adapter could be added without touching the services. */
public interface FileStorage {

    /** The result of storing a file: an internal key, the size and the SHA-256. */
    record StoredFile(String key, long size, String sha256) {
    }

    /** Stores the stream under a server-generated key (never a client-supplied name). Fails above the size limit. */
    StoredFile store(InputStream data) throws IOException;

    Resource load(String key);

    void delete(String key);
}