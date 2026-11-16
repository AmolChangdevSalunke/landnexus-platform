package com.landnexus.projects.infrastructure;

import com.landnexus.projects.domain.RoutingRule;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoutingRuleRepository extends JpaRepository<RoutingRule, UUID> {

    List<RoutingRule> findByActiveTrueOrderByMinAreaHaAsc();

    List<RoutingRule> findAllByOrderByMinAreaHaAscNameAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    long countByActiveTrue();
}
