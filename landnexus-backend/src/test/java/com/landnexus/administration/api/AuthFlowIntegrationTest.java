package com.landnexus.administration.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * End-to-end: real database, real JWTs, real filter chain.
 * Each test creates its own throw-away AUDITOR user (random name) and removes it afterwards.
 */
@SpringBootTest
class AuthFlowIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String STATES = "/api/v1/administration/states";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String username;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        username = "it-" + UUID.randomUUID().toString().substring(0, 8);
        UserAccount user = new UserAccount();
        user.setUsername(username);
        user.setEmail(username + "@test.invalid");
        user.setFullName("Integration Test");
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setEnabled(true);
        user.getRoles().add(roles.findByCode("AUDITOR").orElseThrow());
        users.saveAndFlush(user);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username = ?)", username);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = ?)", username);
        jdbc.update("DELETE FROM users WHERE username = ?", username);
    }

    private ResultActions login(String name, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + name + "\",\"password\":\"" + password + "\"}"));
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refreshToken + "\"}"));
    }

    private static String field(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    @Test
    void login_returnsTokens_andMeShowsRolesAndPermissions() throws Exception {
        MvcResult result = login(username, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andReturn();
        String accessToken = field(result, "$.accessToken");

        MvcResult me = mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username))
                .andReturn();

        List<String> roleCodes = JsonPath.read(me.getResponse().getContentAsString(), "$.roles");
        List<String> permissions = JsonPath.read(me.getResponse().getContentAsString(), "$.permissions");
        assertThat(roleCodes).containsExactly("AUDITOR");
        assertThat(permissions).contains("MASTER_DATA_READ", "USER_READ").doesNotContain("MASTER_DATA_WRITE");
    }

    @Test
    void auditorToken_canRead_butCannotWrite() throws Exception {
        String accessToken = field(login(username, PASSWORD).andReturn(), "$.accessToken");

        mockMvc.perform(get(STATES).header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
        mockMvc.perform(post(STATES)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"AUD1\",\"name\":\"Should Not Be Created\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void wrongPassword_returns401WithGenericMessage() throws Exception {
        login(username, "Wrong-Passw0rd-999")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void fiveWrongPasswords_lockTheAccount_evenForTheCorrectPassword() throws Exception {
        for (int i = 0; i < 5; i++) {
            login(username, "Wrong-Passw0rd-999").andExpect(status().isUnauthorized());
        }
        login(username, PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void disabledUser_cannotLogIn() throws Exception {
        jdbc.update("UPDATE users SET enabled = false WHERE username = ?", username);

        login(username, PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_rotatesTheToken_andReuseKillsTheWholeSession() throws Exception {
        MvcResult first = login(username, PASSWORD).andExpect(status().isOk()).andReturn();
        String refresh1 = field(first, "$.refreshToken");

        MvcResult second = refresh(refresh1).andExpect(status().isOk()).andReturn();
        String refresh2 = field(second, "$.refreshToken");
        assertThat(refresh2).isNotEqualTo(refresh1);

        refresh(refresh1).andExpect(status().isUnauthorized());
        refresh(refresh2).andExpect(status().isUnauthorized());
    }

    @Test
    void logout_revokesTheRefreshToken() throws Exception {
        String refreshToken = field(login(username, PASSWORD).andReturn(), "$.refreshToken");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isNoContent());

        refresh(refreshToken).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshWithGarbage_returns401() throws Exception {
        refresh("this-is-not-a-real-token").andExpect(status().isUnauthorized());
    }
}
