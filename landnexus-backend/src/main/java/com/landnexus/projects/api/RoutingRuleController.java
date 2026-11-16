package com.landnexus.projects.api;

import com.landnexus.projects.api.dto.RoutingRuleDtos.RoutingRuleRequest;
import com.landnexus.projects.api.dto.RoutingRuleDtos.RoutingRuleResponse;
import com.landnexus.projects.application.RoutingRuleAdminService;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects/routing-rules")
public class RoutingRuleController {

    private final RoutingRuleAdminService service;

    public RoutingRuleController(RoutingRuleAdminService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('ROUTING_RULE_READ')")
    @GetMapping
    public List<RoutingRuleResponse> list() {
        return service.list();
    }

    @PreAuthorize("hasAuthority('ROUTING_RULE_MANAGE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoutingRuleResponse create(@Valid @RequestBody RoutingRuleRequest request, Authentication authentication) {
        return service.create(request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('ROUTING_RULE_MANAGE')")
    @PutMapping("/{id}")
    public RoutingRuleResponse update(@PathVariable UUID id, @Valid @RequestBody RoutingRuleRequest request,
                                      Authentication authentication) {
        return service.update(id, request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('ROUTING_RULE_MANAGE')")
    @PostMapping("/{id}/activate")
    public RoutingRuleResponse activate(@PathVariable UUID id, Authentication authentication) {
        return service.setActive(id, true, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('ROUTING_RULE_MANAGE')")
    @PostMapping("/{id}/deactivate")
    public RoutingRuleResponse deactivate(@PathVariable UUID id, Authentication authentication) {
        return service.setActive(id, false, CurrentActor.from(authentication));
    }
}
