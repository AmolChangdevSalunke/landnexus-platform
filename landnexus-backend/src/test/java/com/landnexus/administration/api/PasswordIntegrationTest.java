package com.landnexus.administration.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.JsonPath;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import java.util.Locale;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** Real database, real filter chains (including the public reset chain), real tokens. */
@SpringBootTest
class PasswordIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String NEW = "Another-Passw0rd-456";
    private static final String CHANGE = "/api/v1/auth/change-password";
    private static final String RESET = "/api/v1/auth/reset-password";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String prefix;
    private UUID targetId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "it10-" + UUID.randomUUID().toString().substring(0, 8).toLowerCase(Locale.ROOT) + "-";
        user("superadmin", "SUPER_ADMIN");
        user("central", "CENTRAL_ADMIN");
        targetId = user("target", "FIELD_OFFICER");
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id IN " + owners + " OR issued_by_user_id IN " + owners, like, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
    }

    private UUID user(String name, String role) {
        UserAccount u = new UserAccount();
        u.setUsername(prefix + name);
        u.setEmail(prefix + name + "@test.invalid");
        u.setFullName("Integration " + name);
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        u.setEnabled(true);
        u.getRoles().add(roles.findByCode(role).orElseThrow());
        return users.saveAndFlush(u).getId();
    }

    private MvcResult login(String name, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + prefix + name + "\",\"password\":\"" + password + "\"}")).andReturn();
    }

    private String bearer(String name, String password) throws Exception {
        MvcResult r = login(name, password);
        expect(r, 200);
        return "Bearer " + JsonPath.<String>read(r.getResponse().getContentAsString(), "$.accessToken");
    }

    private MvcResult send(String token, String path, String json) throws Exception {
        MockHttpServletRequestBuilder request = post(path);
        if (token != null) {
            request = request.header("Authorization", token);
        }
        if (json != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mockMvc.perform(request).andReturn();
    }

    private void expect(MvcResult r, int code) throws Exception {
        assertThat(r.getResponse().getStatus())
                .as("%s %s -> body: %s", r.getRequest().getMethod(), r.getRequest().getRequestURI(), r.getResponse().getContentAsString())
                .isEqualTo(code);
    }

    private static String change(String current, String next) {
        return "{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next + "\"}";
    }

    private static String reset(String code, String next) {
        return "{\"code\":\"" + code + "\",\"newPassword\":\"" + next + "\"}";
    }

    private String issueFor(String superToken) throws Exception {
        MvcResult r = send(superToken, "/api/v1/administration/users/" + targetId + "/password-reset", null);
        expect(r, 200);
        return JsonPath.read(r.getResponse().getContentAsString(), "$.code");
    }

    @Test
    void changePassword_checksTheOldOne_enforcesThePolicy_andEndsTheOldPassword() throws Exception {
        String token = bearer("target", PASSWORD);

        expect(send(token, CHANGE, change(PASSWORD, "short")), 400);
        expect(send(token, CHANGE, change("Wrong-Passw0rd-9", NEW)), 400);
        expect(send(token, CHANGE, change(PASSWORD, PASSWORD)), 400);
        expect(send(token, CHANGE, change(PASSWORD, prefix + "Aa1")), 400);   // contains the user name
        expect(send(null, CHANGE, change(PASSWORD, NEW)), 401);
        expect(send(token, CHANGE, change(PASSWORD, NEW)), 204);

        expect(login("target", PASSWORD), 401);
        expect(login("target", NEW), 200);
    }

    @Test
    void resetCode_isIssuedOnlyByASuperAdmin_worksOnce_expires_andANewerCodeReplacesTheOlder() throws Exception {
        String superToken = bearer("superadmin", PASSWORD);
        expect(send(bearer("target", PASSWORD), "/api/v1/administration/users/" + targetId + "/password-reset", null), 403);
        expect(send(bearer("central", PASSWORD), "/api/v1/administration/users/" + targetId + "/password-reset", null), 403);
        expect(send(superToken, "/api/v1/administration/users/" + UUID.randomUUID() + "/password-reset", null), 404);

        String code = issueFor(superToken);
        assertThat(code).hasSizeGreaterThanOrEqualTo(30);
        String stored = jdbc.queryForObject("SELECT token_hash FROM password_reset_tokens WHERE user_id = ?::uuid AND used_at IS NULL", String.class, targetId.toString());
        assertThat(stored).isNotEqualTo(code).hasSize(64);   // only a hash is kept

        expect(send(null, RESET, reset(code, "short")), 400);   // a weak password does not use up the code
        expect(send(null, RESET, reset(code, NEW)), 204);       // no login needed
        expect(send(null, RESET, reset(code, NEW)), 400);       // used
        expect(login("target", NEW), 200);
        expect(login("target", PASSWORD), 401);
        expect(send(null, RESET, reset("not-a-real-code", NEW)), 400);

        String older = issueFor(superToken);
        String newer = issueFor(superToken);
        expect(send(null, RESET, reset(older, PASSWORD)), 400);
        expect(send(null, RESET, reset(newer, PASSWORD)), 204);

        String expired = issueFor(superToken);
        jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = ?::uuid AND used_at IS NULL", targetId.toString());
        expect(send(null, RESET, reset(expired, NEW)), 400);
    }
}