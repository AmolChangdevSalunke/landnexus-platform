package com.landnexus.reporting.application;

import com.landnexus.reporting.api.dto.SlaDtos.ScanResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/** Runs the SLA scan on a timer. OFF unless landnexus.sla.scheduler.enabled=true (environment variable LANDNEXUS_SLA_SCHEDULER). */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(name = "landnexus.sla.scheduler.enabled", havingValue = "true")
public class SlaScheduler {

    private static final Logger log = LoggerFactory.getLogger(SlaScheduler.class);

    private final SlaService service;

    public SlaScheduler(SlaService service) {
        this.service = service;
    }

    @Scheduled(initialDelayString = "${landnexus.sla.initial-delay-ms:300000}", fixedDelayString = "${landnexus.sla.scan-interval-ms:900000}")
    public void run() {
        long started = System.nanoTime();
        try {
            ScanResult r = service.scanAsScheduler();
            log.info("SLA scan: {} warnings, {} breaches, {} notifications ({} ms)",
                    r.warningsRaised(), r.breachesRaised(), r.notificationsSent(),
                    (System.nanoTime() - started) / 1_000_000L);
        } catch (RuntimeException e) {
            log.error("SLA scan failed after {} ms", (System.nanoTime() - started) / 1_000_000L, e);
        }
    }
}