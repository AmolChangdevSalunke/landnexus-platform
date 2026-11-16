package com.landnexus.administration.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Real database, real filter chain. Audit and login-history rows are append-only by design, so these tests
 * leave a few rows tagged with the actor "it-actor" / "it2-..." behind; everything else is removed again.
 */
@SpringBootTest
@ActiveProfiles("integration")
class AuditAndScopeIntegrationTest extends AbstractIsolatedPgIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String BASE = "/api/v1/administration";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix;
    private String username;
    private final UUID actorId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        username = "it2-" + suffix.toLowerCase(Locale.ROOT);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN (SELECT id FROM users WHERE username = ?)", username);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username = ?)", username);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = ?)", username);
        jdbc.update("DELETE FROM users WHERE username = ?", username);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code IN (?, ?))", "ITA" + suffix, "ITB" + suffix);
        jdbc.update("DELETE FROM states WHERE code IN (?, ?)", "ITA" + suffix, "ITB" + suffix);
    }

    private RequestPostProcessor admin() {
        return jwt()
                .jwt(j -> j.subject(actorId.toString()).claim("username", "it-actor"))
                .authorities(
                        new SimpleGrantedAuthority("ROLE_CENTRAL_ADMIN"),
                        new SimpleGrantedAuthority("MASTER_DATA_READ"),
                        new SimpleGrantedAuthority("MASTER_DATA_WRITE"),
                        new SimpleGrantedAuthority("USER_READ"),
                        new SimpleGrantedAuthority("USER_WRITE"),
                        new SimpleGrantedAuthority("AUDIT_READ"));
    }

    private String create(String path, String json) throws Exception {
        MvcResult result = mockMvc.perform(post(BASE + path).with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    private void createUser(String roleCode) {
        UserAccount user = new UserAccount();
        user.setUsername(username);
        user.setEmail(username + "@test.invalid");
        user.setFullName("Integration Test");
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setEnabled(true);
        user.getRoles().add(roles.findByCode(roleCode).orElseThrow());
        users.saveAndFlush(user);
    }

    private String loginToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    @Test
    void masterDataChange_isAudited_andStampsCreatedBy() throws Exception {
        String stateId = create("/states", "{\"code\":\"ITA" + suffix + "\",\"name\":\"Audit Test State\"}");

        String createdBy = jdbc.queryForObject("SELECT created_by FROM states WHERE code = ?", String.class, "ITA" + suffix);
        assertThat(createdBy).isEqualTo("it-actor");

        mockMvc.perform(get(BASE + "/audit-events").with(admin())
                        .param("entityType", "State").param("entityId", stateId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].action").value("CREATE"))
                .andExpect(jsonPath("$.content[0].actorUsername").value("it-actor"));
    }

    @Test
    void auditTrail_cannotBeChangedOrDeleted() throws Exception {
        create("/states", "{\"code\":\"ITA" + suffix + "\",\"name\":\"Append Only Test\"}");

        assertThatThrownBy(() -> jdbc.update("UPDATE audit_events SET details = 'tampered' WHERE actor_username = ?", "it-actor"))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM audit_events WHERE actor_username = ?", "it-actor"))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void auditEndpoints_needAuditReadPermission() throws Exception {
        mockMvc.perform(get(BASE + "/audit-events")
                        .with(jwt().authorities(new SimpleGrantedAuthority("MASTER_DATA_READ"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/login-history")
                        .with(jwt().authorities(new SimpleGrantedAuthority("MASTER_DATA_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void entityIdWithoutEntityType_returns400() throws Exception {
        mockMvc.perform(get(BASE + "/audit-events").with(admin()).param("entityId", UUID.randomUUID().toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginAttempts_areRecordedInHistory() throws Exception {
        createUser("AUDITOR");

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .header("User-Agent", "IT-Agent")
                        .content("{\"username\":\"" + username + "\",\"password\":\"Wrong-Passw0rd-999\"}"))
                .andExpect(status().isUnauthorized());
        loginToken();

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT success, failure_reason, user_agent FROM login_history WHERE username_attempted = ? ORDER BY occurred_at",
                username);
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).get("success")).isEqualTo(false);
        assertThat(rows.get(0).get("failure_reason")).isEqualTo("BAD_PASSWORD");
        assertThat(rows.get(0).get("user_agent")).isEqualTo("IT-Agent");
        assertThat(rows.get(1).get("success")).isEqualTo(true);

        mockMvc.perform(get(BASE + "/login-history").with(admin()).param("username", username))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void geographicScope_limitsTheDistrictsAUserCanSee() throws Exception {
        String stateA = create("/states", "{\"code\":\"ITA" + suffix + "\",\"name\":\"Scope State A\"}");
        String stateB = create("/states", "{\"code\":\"ITB" + suffix + "\",\"name\":\"Scope State B\"}");
        String districtA = create("/districts", "{\"code\":\"D1\",\"name\":\"District in A\",\"stateId\":\"" + stateA + "\"}");
        create("/districts", "{\"code\":\"D1\",\"name\":\"District in B\",\"stateId\":\"" + stateB + "\"}");
        createUser("STATE_ADMIN");
        UUID userId = users.findByUsername(username).orElseThrow().getId();

        // before any assignment a scoped role sees nothing
        String token = loginToken();
        mockMvc.perform(get(BASE + "/my-districts").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(put(BASE + "/users/" + userId + "/scopes").with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scopes\":[{\"stateId\":\"" + stateA + "\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("STATE"));

        mockMvc.perform(get(BASE + "/my-districts").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(districtA));

        mockMvc.perform(put(BASE + "/users/" + userId + "/scopes").with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scopes\":[{\"stateId\":\"" + stateA + "\",\"districtId\":\"" + districtA + "\"}]}"))
                .andExpect(status().isBadRequest());

        // a scoped user is not an auditor
        mockMvc.perform(get(BASE + "/audit-events").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }
}
