package com.landnexus.shared.pagination;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

class PageParamsSortTest {

    @Test
    void ofDescending_sortsNewestFirst_andCapsTheSize() {
        Pageable pageable = PageParams.ofDescending(-1, 100000, "occurredAt");

        assertThat(pageable.getPageNumber()).isZero();
        assertThat(pageable.getPageSize()).isEqualTo(PageParams.MAX_SIZE);
        assertThat(pageable.getSort().getOrderFor("occurredAt").getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    @Test
    void of_withCustomProperty_sortsAscending() {
        Pageable pageable = PageParams.of(0, 10, "username");

        assertThat(pageable.getSort().getOrderFor("username").getDirection()).isEqualTo(Sort.Direction.ASC);
    }
}
