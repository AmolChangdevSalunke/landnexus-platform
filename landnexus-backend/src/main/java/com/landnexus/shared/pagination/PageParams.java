package com.landnexus.shared.pagination;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/** Builds safe Pageable objects: page >= 0, 1 <= size <= MAX_SIZE, sorted by name. */
public final class PageParams {

    public static final int MAX_SIZE = 100;

    private PageParams() {
    }

    public static Pageable of(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_SIZE);
        return PageRequest.of(safePage, safeSize, Sort.by("name").ascending());
    }
}
