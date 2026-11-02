package com.landnexus.shared.pagination;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/** Builds safe Pageable objects: page >= 0, 1 <= size <= MAX_SIZE, sorted by a property. */
public final class PageParams {

    public static final int MAX_SIZE = 100;

    private PageParams() {
    }

    /** Sorted by "name" ascending (master-data tables). */
    public static Pageable of(int page, int size) {
        return of(page, size, "name");
    }

    public static Pageable of(int page, int size, String sortBy) {
        return PageRequest.of(safePage(page), safeSize(size), Sort.by(sortBy).ascending());
    }

    /** Newest first, for logs such as audit events and login history. */
    public static Pageable ofDescending(int page, int size, String sortBy) {
        return PageRequest.of(safePage(page), safeSize(size), Sort.by(sortBy).descending());
    }

    private static int safePage(int page) {
        return Math.max(page, 0);
    }

    private static int safeSize(int size) {
        return Math.min(Math.max(size, 1), MAX_SIZE);
    }
}
