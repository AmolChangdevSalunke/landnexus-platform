package com.landnexus.shared.openapi;

import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/meta")
public class MetaController {

    private final OpenApiService openApi;

    public MetaController(OpenApiService openApi) {
        this.openApi = openApi;
    }

    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @GetMapping("/openapi.json")
    public Map<String, Object> openApi() {
        return openApi.document();
    }
}