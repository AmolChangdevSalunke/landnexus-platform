package com.landnexus.shared.openapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("integration")
class OpenApiServiceTest extends AbstractIsolatedPgIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private OpenApiService service;

    @Test
    void theDocumentDescribesTheRealEndpoints_theirPermissions_andDtoShapes() {
        String json = com.jayway.jsonpath.JsonPath.parse(service.document()).jsonString();

        assertThat(JsonPath.<String>read(json, "$.openapi")).isEqualTo("3.0.3");
        assertThat(JsonPath.<java.util.Map<String, Object>>read(json, "$.paths")).hasSizeGreaterThan(60);
        assertThat(JsonPath.<String>read(json, "$.paths['/api/v1/land-records/parcels'].get['x-required-permission']")).isEqualTo("LAND_RECORD_READ");
        assertThat(JsonPath.<String>read(json, "$.paths['/api/v1/land-records/parcels'].post['x-required-permission']")).isEqualTo("LAND_RECORD_WRITE");
        assertThat(JsonPath.<String>read(json, "$.paths['/api/v1/auth/reset-password'].post['x-required-permission']")).isEqualTo("public");
        assertThat(JsonPath.<List<Object>>read(json, "$.paths['/api/v1/auth/reset-password'].post.security")).isEmpty();
        assertThat(JsonPath.<List<String>>read(json, "$.components.schemas.ParcelRequest.required")).contains("villageId", "areaHa");
        assertThat(JsonPath.<String>read(json, "$.paths['/api/v1/land-records/parcels/{parcelId}/documents'].post.requestBody.content['multipart/form-data'].schema.properties.file.format"))
                .isEqualTo("binary");
    }

    @Test
    void theCatalogueIsForAdministratorsOnly() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        mockMvc.perform(get("/api/v1/meta/openapi.json").with(jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/meta/openapi.json")
                        .with(jwt().jwt(j -> j.subject(UUID.randomUUID().toString())).authorities(new SimpleGrantedAuthority("SETTINGS_MANAGE"))))
                .andExpect(status().isOk());
    }
}