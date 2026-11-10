package com.landnexus.reporting.application;

import com.landnexus.reporting.api.dto.ForecastDtos.ForecastItem;
import com.landnexus.reporting.api.dto.ForecastDtos.ForecastOverview;
import com.landnexus.reporting.api.dto.ForecastDtos.StageStat;
import com.landnexus.reporting.application.TimelineForecaster.Result;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.ForecastRepository;
import com.landnexus.reporting.infrastructure.ForecastRepository.OpenItem;
import com.landnexus.reporting.infrastructure.SlaRepository;
import com.landnexus.reporting.infrastructure.SlaRepository.RuleRow;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Predictive timeline analytics: which waiting items are likely to breach their SLA, and which stages are the bottlenecks. */
@Service
@Transactional(readOnly = true)
public class ForecastService {

    static final int HISTORY_LIMIT = 2000;
    static final int MAX_ITEMS = 100;
    static final String METHOD = "STATISTICAL_HISTORY";

    private final ForecastRepository repo;
    private final SlaRepository slaRepo;
    private final ReportingScope scopes;
    private final Clock clock;

    public ForecastService(ForecastRepository repo, SlaRepository slaRepo, ReportingScope scopes, Clock clock) {
        this.repo = repo;
        this.slaRepo = slaRepo;
        this.scopes = scopes;
        this.clock = clock;
    }

    public ForecastOverview overview(UUID stateId, UUID districtId, CurrentActor actor) {
        DistrictScope scope = scopes.resolve(actor, stateId, districtId);
        List<RuleRow> rules = slaRepo.rules().stream().filter(RuleRow::active)
                .filter(r -> !"OBJECTION_WINDOW_NOT_CLOSED".equals(r.itemType())).toList();
        Map<String, double[]> history = new HashMap<>();
        for (RuleRow rule : rules) {
            history.put(rule.itemType(), repo.durations(rule.itemType(), HISTORY_LIMIT));
        }
        Map<String, long[]> counts = new HashMap<>();   // [open, at risk]
        List<ForecastItem> risky = new ArrayList<>();
        for (OpenItem item : repo.openItems(scope, 1000)) {
            double[] hours = history.get(item.itemType());
            if (hours == null) {
                continue;
            }
            Result r = TimelineForecaster.forecast(item.ageHours(), item.breachHours(), hours);
            long[] c = counts.computeIfAbsent(item.itemType(), k -> new long[2]);
            c[0]++;
            if ("HIGH".equals(r.level()) || "MEDIUM".equals(r.level())) {
                c[1]++;
                risky.add(new ForecastItem(item.itemType(), item.title(), item.entityId(), item.reference(), item.districtId(), item.since(),
                        TimelineForecaster.round(item.ageHours(), 1), r.level(), r.breachProbability(), r.expectedRemainingHours(),
                        r.samples(), r.comparable(), r.explanation(), item.responsibleRole()));
            }
        }
        risky.sort(Comparator.comparingInt((ForecastItem i) -> "HIGH".equals(i.risk()) ? 0 : 1)
                .thenComparing(i -> -(i.breachProbability() == null ? 1.0 : i.breachProbability()))
                .thenComparing(i -> -i.ageHours()));
        boolean truncated = risky.size() > MAX_ITEMS;

        List<StageStat> stages = new ArrayList<>();
        for (RuleRow rule : rules) {
            double[] hours = history.get(rule.itemType());
            long[] c = counts.getOrDefault(rule.itemType(), new long[2]);
            stages.add(new StageStat(rule.itemType(), rule.title(), hours.length, percentile(hours, 0.5), percentile(hours, 0.9),
                    rule.warnAfterHours(), rule.breachAfterHours(), c[0], c[1]));
        }
        stages.sort(Comparator.comparingLong((StageStat s) -> -s.atRisk()).thenComparing(StageStat::itemType));
        return new ForecastOverview(clock.instant(), METHOD,
                "A statistical forecast from this system's own completed items (medians, 90th percentiles and conditional shares). "
                        + "It is not machine learning and learns nothing.",
                stages, truncated ? risky.subList(0, MAX_ITEMS) : risky, truncated,
                List.of("History covers all districts; only the waiting items are limited to your geographic scope.",
                        "With fewer than " + TimelineForecaster.MIN_SAMPLES + " completed items of a kind the forecast says INSUFFICIENT_DATA instead of guessing.",
                        "A forecast is an indicator for planning, never a reason to change a status automatically."));
    }

    /** Nearest-rank percentile of an ascending array; null when there is no data. */
    static Double percentile(double[] sortedAsc, double p) {
        if (sortedAsc.length == 0) {
            return null;
        }
        int index = (int) Math.ceil(p * sortedAsc.length) - 1;
        return TimelineForecaster.round(sortedAsc[Math.max(0, Math.min(index, sortedAsc.length - 1))], 1);
    }
}