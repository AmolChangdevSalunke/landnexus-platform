package com.landnexus.shared.ratelimit;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Counts events per key inside a sliding time window. Thread-safe; old keys are dropped so memory stays bounded. */
public final class SlidingWindowCounter {

    private final Map<String, Deque<Long>> events = new ConcurrentHashMap<>();
    private final int maxKeys;
    private final long retentionMs;

    public SlidingWindowCounter(int maxKeys, long retentionMs) {
        this.maxKeys = maxKeys;
        this.retentionMs = retentionMs;
    }

    public void add(String key, long nowMs) {
        if (events.size() >= maxKeys) {
            purge(nowMs);
        }
        Deque<Long> d = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (d) {
            d.addLast(nowMs);
        }
    }

    public int count(String key, long nowMs, long windowMs) {
        Deque<Long> d = events.get(key);
        if (d == null) {
            return 0;
        }
        synchronized (d) {
            while (!d.isEmpty() && d.peekFirst() <= nowMs - windowMs) {
                d.pollFirst();
            }
            return d.size();
        }
    }

    /** How long until the oldest counted event leaves the window (then one more event is allowed). */
    public long retryAfterMs(String key, long nowMs, long windowMs) {
        Deque<Long> d = events.get(key);
        if (d == null) {
            return 0;
        }
        synchronized (d) {
            Long first = d.peekFirst();
            return first == null ? 0 : Math.max(0, first + windowMs - nowMs);
        }
    }

    private void purge(long nowMs) {
        events.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                Long last = e.getValue().peekLast();
                return last == null || last <= nowMs - retentionMs;
            }
        });
    }
}