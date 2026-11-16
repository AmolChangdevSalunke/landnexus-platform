package com.landnexus.administration.api;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** Proves the backend itself enforces authentication and permissions (needs the local database, like contextLoads). */
@SpringBootTest
@ActiveProfiles("integration")
class SecurityEndpointsTest extends AbstractIsolatedPgIntegrationTest {

    private static final String STATES = "/api/v1/administration/states";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void noToken_returns401WithJsonBody() throws Exception {
        mockMvc.perform(get(STATES))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void garbageToken_returns401() throws Exception {
        mockMvc.perform(get(STATES).header("Authorization", "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void readPermission_canList() throws Exception {
        mockMvc.perform(get(STATES).with(jwt().authorities(new SimpleGrantedAuthority("MASTER_DATA_READ"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").exists());
    }

    @Test
    void authenticatedButNoPermission_returns403() throws Exception {
        mockMvc.perform(get(STATES).with(jwt()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void readOnlyPermission_cannotCreate() throws Exception {
        mockMvc.perform(post(STATES)
                        .with(jwt().authorities(new SimpleGrantedAuthority("MASTER_DATA_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"SEC1\",\"name\":\"Security Test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void routingRuleChanges_requireManagePermission() throws Exception {
        mockMvc.perform(post("/api/v1/projects/routing-rules")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROUTING_RULE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Authorization boundary test",
                                  "minAreaHa": 1,
                                  "maxAreaHa": 2,
                                  "projectType": "HIGHWAY",
                                  "decisionLevel": "DISTRICT",
                                  "note": "synthetic security test"
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void rolePermissionChanges_requireRoleManagePermission() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                                "/api/v1/administration/roles/" + java.util.UUID.randomUUID() + "/permissions")
                        .with(jwt().authorities(new SimpleGrantedAuthority("USER_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[]}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void perUserPermissionChanges_requireDedicatedManagePermission() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                                "/api/v1/administration/users/" + java.util.UUID.randomUUID() + "/permissions")
                        .with(jwt().authorities(new SimpleGrantedAuthority("USER_WRITE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"overrides\":[]}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void userList_needsUserReadPermission() throws Exception {
        mockMvc.perform(get("/api/v1/administration/users")
                        .with(jwt().authorities(new SimpleGrantedAuthority("MASTER_DATA_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void me_needsAToken() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void healthEndpoint_isPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    void loginEndpoint_isPublic_andRejectsBadCredentialsWith401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nobody-here\",\"password\":\"wrong-password-1\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }
}
