package com.landnexus.administration.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("integration")
class UserPermissionIntegrationTest extends AbstractIsolatedPgIntegrationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private UserAccount target;
    private UUID rootId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        rootId = UUID.randomUUID();
        target = new UserAccount();
        target.setUsername("permission-it-" + UUID.randomUUID().toString().substring(0, 8));
        target.setEmail(target.getUsername() + "@test.invalid");
        target.setFullName("Permission Integration");
        target.setPasswordHash(passwordEncoder.encode("Test-Passw0rd-123"));
        target.getRoles().add(roles.findByCode("AUDITOR").orElseThrow());
        target = users.saveAndFlush(target);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id = ?", target.getId());
        jdbc.update("DELETE FROM user_permission_overrides WHERE user_id = ?", target.getId());
        jdbc.update("DELETE FROM user_roles WHERE user_id = ?", target.getId());
        jdbc.update("DELETE FROM users WHERE id = ?", target.getId());
    }

    @Test
    void superAdminOverrideIsAuditedAndAppliedToNextLoginAuthorities() throws Exception {
        String path = "/api/v1/administration/users/" + target.getId() + "/permissions";
        var oldLogin = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"" + target.getUsername() + "\",\"password\":\"Test-Passw0rd-123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String oldToken = JsonPath.read(oldLogin.getResponse().getContentAsString(), "$.accessToken");

        mockMvc.perform(put(path).with(superAdmin("PROPOSAL_READ"))
                        .contentType("application/json")
                        .content("{\"overrides\":[{\"code\":\"PROPOSAL_READ\",\"granted\":true},"
                                + "{\"code\":\"AUDIT_READ\",\"granted\":false}]}")
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions[?(@.code == 'PROPOSAL_READ')].effective").value(true));
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized());

        assertThat(jdbc.queryForObject("""
                SELECT granted FROM user_permission_overrides o
                JOIN permissions p ON p.id=o.permission_id WHERE o.user_id=? AND p.code='PROPOSAL_READ'
                """, Boolean.class, target.getId())).isTrue();
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM audit_events WHERE entity_type='UserAccount' AND entity_id=? AND action='REPLACE_USER_PERMISSIONS'
                """, Integer.class, target.getId())).isEqualTo(1);

        var login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"" + target.getUsername() + "\",\"password\":\"Test-Passw0rd-123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions").value(org.hamcrest.Matchers.hasItem("PROPOSAL_READ")))
                .andExpect(jsonPath("$.permissions").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.hasItem("AUDIT_READ"))));
    }

    @Test
    void callerWithoutManageAuthorityCannotUpdateOverrides() throws Exception {
        mockMvc.perform(put("/api/v1/administration/users/" + target.getId() + "/permissions")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(jwt -> jwt.subject(rootId.toString()).claim("username", "ordinary"))
                                .authorities(() -> "USER_READ"))
                        .contentType("application/json")
                        .content("{\"overrides\":[]}"))
                .andExpect(status().isForbidden());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_permission_overrides WHERE user_id=?",
                Integer.class, target.getId())).isZero();
    }

    @Test
    void callerCannotGrantPermissionNotPresentInItsOwnAuthorities() throws Exception {
        mockMvc.perform(put("/api/v1/administration/users/" + target.getId() + "/permissions")
                        .with(superAdmin())
                        .contentType("application/json")
                        .content("{\"overrides\":[{\"code\":\"PROPOSAL_READ\",\"granted\":true}]}")
                )
                .andExpect(status().isForbidden());
    }

    private SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor superAdmin(String... extraPermissions) {
        var processor = SecurityMockMvcRequestPostProcessors.jwt()
                .jwt(jwt -> jwt.subject(rootId.toString()).claim("username", "root"))
                .authorities(() -> "ROLE_SUPER_ADMIN", () -> "USER_PERMISSION_MANAGE");
        if (extraPermissions.length > 0) {
            processor.authorities(() -> "ROLE_SUPER_ADMIN", () -> "USER_PERMISSION_MANAGE",
                    () -> extraPermissions[0]);
        }
        return processor;
    }
}
