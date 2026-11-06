package com.landnexus.landrecords.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.landrecords.infrastructure.FileStorage.StoredFile;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalFileStorageTest {

    @TempDir Path dir;

    private long files() throws IOException {
        try (Stream<Path> s = Files.walk(dir)) {
            return s.filter(Files::isRegularFile).count();
        }
    }

    @Test
    void storesUnderARandomKey_withSizeAndSha256_andLoadsItBack() throws IOException {
        LocalFileStorage storage = new LocalFileStorage(dir.toString(), 100);

        StoredFile stored = storage.store(new ByteArrayInputStream("abc".getBytes()));

        assertThat(stored.size()).isEqualTo(3);
        assertThat(stored.sha256()).isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assertThat(stored.key()).endsWith(".bin");
        assertThat(Files.readAllBytes(storage.load(stored.key()).getFile().toPath())).isEqualTo("abc".getBytes());
    }

    @Test
    void aFileAboveTheLimit_isRefused_andNothingIsLeftBehind() throws IOException {
        LocalFileStorage storage = new LocalFileStorage(dir.toString(), 10);

        assertThatThrownBy(() -> storage.store(new ByteArrayInputStream(new byte[50])))
                .isInstanceOf(InvalidRequestException.class);
        assertThat(files()).isZero();
    }

    @Test
    void aKeyCannotEscapeTheStorageFolder() {
        LocalFileStorage storage = new LocalFileStorage(dir.toString(), 100);

        assertThatThrownBy(() -> storage.load("../outside.bin")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.load("2026/01/missing.bin")).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deleteRemovesTheFile_andIsHarmlessTwice() throws IOException {
        LocalFileStorage storage = new LocalFileStorage(dir.toString(), 100);
        StoredFile stored = storage.store(new ByteArrayInputStream("x".getBytes()));

        storage.delete(stored.key());
        storage.delete(stored.key());

        assertThat(files()).isZero();
    }

    @Test
    void aMissingFolderSetting_failsAtStartup() {
        assertThatThrownBy(() -> new LocalFileStorage(" ", 100)).isInstanceOf(IllegalStateException.class);
    }
}