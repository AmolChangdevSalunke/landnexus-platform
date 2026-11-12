package com.landnexus.reporting.application;

import com.landnexus.reporting.infrastructure.SlaRepository;
import java.util.OptionalInt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Small published lookup so other modules can use the configured SLA warning limit without reading the
 * reporting module's tables directly. Read-only and free of personal data.
 */
@Service
@Transactional(readOnly = true)
public class SlaLookupService {

    private final SlaRepository repo;

    public SlaLookupService(SlaRepository repo) {
        this.repo = repo;
    }

    public OptionalInt warningHours(String itemType) {
        return repo.rule(itemType)
                .filter(SlaRepository.RuleRow::active)
                .map(rule -> OptionalInt.of(rule.warnAfterHours()))
                .orElseGet(OptionalInt::empty);
    }
}
