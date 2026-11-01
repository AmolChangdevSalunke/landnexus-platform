package com.landnexus.shared.pagination;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

class PageParamsTest {

    @Test
    void negativePage_becomesZero_andSizeIsCapped() {
        Pageable pageable = PageParams.of(-5, 100000);
        assertThat(pageable.getPageNumber()).isZero();
        assertThat(pageable.getPageSize()).isEqualTo(PageParams.MAX_SIZE);
    }

    @Test
    void zeroSize_becomesOne() {
        assertThat(PageParams.of(0, 0).getPageSize()).isEqualTo(1);
    }

    @Test
    void sortsByNameAscending() {
        assertThat(PageParams.of(0, 10).getSort().getOrderFor("name")).isNotNull();
    }
}
