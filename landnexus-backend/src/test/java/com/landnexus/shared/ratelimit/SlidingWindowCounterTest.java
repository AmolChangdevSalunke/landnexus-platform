package com.landnexus.shared.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SlidingWindowCounterTest {

    @Test
    void countsInsideTheWindow_forgetsOldEvents_andTellsWhenToRetry() {
        SlidingWindowCounter c = new SlidingWindowCounter(100, 10_000);
        c.add("a", 1_000);
        c.add("a", 2_000);
        c.add("b", 2_000);

        assertThat(c.count("a", 3_000, 5_000)).isEqualTo(2);
        assertThat(c.count("b", 3_000, 5_000)).isEqualTo(1);
        assertThat(c.retryAfterMs("a", 3_000, 5_000)).isEqualTo(3_000);
        assertThat(c.count("a", 6_500, 5_000)).isEqualTo(1);   // the event at 1,000 left the window
        assertThat(c.count("missing", 3_000, 5_000)).isZero();
        assertThat(c.retryAfterMs("missing", 3_000, 5_000)).isZero();
    }

    @Test
    void oldKeysArePurged_whenTheMapIsFull() {
        SlidingWindowCounter c = new SlidingWindowCounter(2, 1_000);
        c.add("old1", 0);
        c.add("old2", 0);
        c.add("new", 5_000);   // full: the stale keys are dropped first

        assertThat(c.count("new", 5_000, 1_000)).isEqualTo(1);
        assertThat(c.count("old1", 5_000, 100_000)).isZero();
    }
}