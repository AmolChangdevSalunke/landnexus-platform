// RuleSetComponentRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.RuleSetComponent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RuleSetComponentRepository extends JpaRepository<RuleSetComponent, UUID> {

    List<RuleSetComponent> findByRuleSetIdOrderByPositionAsc(UUID ruleSetId);
}