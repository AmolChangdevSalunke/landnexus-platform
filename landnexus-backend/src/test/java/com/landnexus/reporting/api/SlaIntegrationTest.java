package com.landnexus.reporting.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** Real database, real filter chain, real tokens. Counts are asserted on the test's own district only. */
@SpringBootTest
class SlaIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String MON = "/api/v1/monitoring";
    private static final String PROPOSALS = "PROPOSAL_AWAITING_SCRUTINY";
    private static final String WINDOW = "OBJECTION_WINDOW_NOT_CLOSED";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix, prefix, stateCode, district1;
    private UUID projectId, scrutinyId, authorityId, consultantId;
    private String national, scrutiny, authority, consultant, field2;
    private List<Map<String, Object>> originalRules;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it9-" + suffix.toLowerCase(Locale.ROOT) + "-";
        stateCode = "ITS" + suffix;

        // pin the two rules this test relies on, and remember the real ones so they can be put back
        originalRules = jdbc.queryForList("SELECT item_type, warn_after_hours, breach_after_hours, responsible_role, escalate_role, active "
                + "FROM sla_rules WHERE item_type IN ('" + PROPOSALS + "', '" + WINDOW + "')");
        jdbc.update("UPDATE sla_rules SET warn_after_hours = 120, breach_after_hours = 240, responsible_role = 'SCRUTINY_OFFICER', "
                + "escalate_role = 'COMPETENT_AUTHORITY', active = TRUE, row_version = row_version + 1 WHERE item_type = ?", PROPOSALS);
        jdbc.update("UPDATE sla_rules SET warn_after_hours = 24, breach_after_hours = 72, responsible_role = 'SCRUTINY_OFFICER', "
                + "escalate_role = 'COMPETENT_AUTHORITY', active = TRUE, row_version = row_version + 1 WHERE item_type = ?", WINDOW);

        String state = admin("/states", "{\"code\":\"" + stateCode + "\",\"name\":\"Sla Test State\"}");
        district1 = admin("/districts", "{\"code\":\"D1\",\"name\":\"District One\",\"stateId\":\"" + state + "\"}");
        String district2 = admin("/districts", "{\"code\":\"D2\",\"name\":\"District Two\",\"stateId\":\"" + state + "\"}");
        String ministry = admin("/ministries", "{\"code\":\"ITSM" + suffix + "\",\"name\":\"Test Ministry\"}");
        String department = admin("/departments", "{\"code\":\"ITSD" + suffix + "\",\"name\":\"Test Department\",\"ministryId\":\""
                + ministry + "\",\"level\":\"STATE\"}");

        scrutinyId = user("scrutiny", "SCRUTINY_OFFICER");
        authorityId = user("authority", "COMPETENT_AUTHORITY");
        consultantId = user("consultant", "CONSULTANT");
        UUID f2 = user("field2", "FIELD_OFFICER");
        user("national", "SUPER_ADMIN");
        scope(scrutinyId, district1);
        scope(authorityId, district1);
        scope(consultantId, district1);
        scope(f2, district2);
        scrutiny = login("scrutiny");
        authority = login("authority");
        consultant = login("consultant");
        field2 = login("field2");
        national = login("national");

        // three proposals waiting for scrutiny: 200 hours (warning), 300 hours (breach) and brand new (on time)
        UUID st = UUID.fromString(state);
        UUID d1 = UUID.fromString(district1);
        UUID dep = UUID.fromString(department);
        proposal("PRP-IT9A-" + suffix, "SUBMITTED", 200, st, d1, dep);
        proposal("PRP-IT9B-" + suffix, "SUBMITTED", 300, st, d1, dep);
        proposal("PRP-IT9C-" + suffix, "SUBMITTED", 0, st, d1, dep);
        // an approved proposal with a project and a case whose objection period ended 10 days ago but is still open
        UUID approved = proposal("PRP-IT9D-" + suffix, "APPROVED", 0, st, d1, dep);
        projectId = UUID.randomUUID();
        jdbc.update("INSERT INTO projects (id, code, proposal_id, title, project_type, status, state_id, district_id, department_id, "
                        + "estimated_land_area_ha, owner_user_id, approved_by_user_id, approved_at) "
                        + "VALUES (?, ?, ?, 'DEMO IT project', 'STATE_HIGHWAY', 'ACTIVE', ?, ?, ?, 10, ?, ?, now())",
                projectId, "PRJ-IT9-" + suffix, approved, st, d1, dep, consultantId, authorityId);
        UUID caseId = UUID.randomUUID();
        jdbc.update("INSERT INTO acquisition_cases (id, case_number, project_id, state_id, district_id, framework, status) "
                + "VALUES (?, ?, ?, ?, ?, 'LARR_2013', 'NOTIFICATION_ISSUED')", caseId, "ACQ-IT9-" + suffix, projectId, st, d1);
        jdbc.update("INSERT INTO legal_notices (case_id, notice_type, reference_number, issued_on, objection_deadline) "
                + "VALUES (?, 'PRELIMINARY_NOTIFICATION', ?, CURRENT_DATE - 40, CURRENT_DATE - 10)", caseId, "DEMO-GZ-" + suffix);
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        String districts = "(SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)";
        jdbc.update("DELETE FROM notifications WHERE recipient_user_id IN " + owners, like);
        try {
            jdbc.execute("ALTER TABLE sla_escalations DISABLE TRIGGER trg_sla_escalations_append_only");
            jdbc.update("DELETE FROM sla_escalations WHERE district_id IN " + districts, stateCode);
        } finally {
            jdbc.execute("ALTER TABLE sla_escalations ENABLE TRIGGER trg_sla_escalations_append_only");
        }
        jdbc.update("DELETE FROM legal_notices WHERE case_id IN (SELECT id FROM acquisition_cases WHERE project_id = ?)", projectId);
        jdbc.update("DELETE FROM acquisition_cases WHERE project_id = ?", projectId);
        jdbc.update("DELETE FROM projects WHERE id = ?", projectId);
        jdbc.update("DELETE FROM proposals WHERE proposal_number LIKE ?", "PRP-IT9_-" + suffix);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITSD" + suffix);
        jdbc.update("DELETE FROM ministries WHERE code = ?", "ITSM" + suffix);
        for (Map<String, Object> r : originalRules) {
            jdbc.update("UPDATE sla_rules SET warn_after_hours = ?, breach_after_hours = ?, responsible_role = ?, escalate_role = ?, "
                            + "active = ?, row_version = row_version + 1 WHERE item_type = ?", r.get("warn_after_hours"), r.get("breach_after_hours"),
                    r.get("responsible_role"), r.get("escalate_role"), r.get("active"), r.get("item_type"));
        }
    }

    // ------------------------------------------------------------------ helpers

    private RequestPostProcessor adminToken() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()).claim("username", "it-actor"))
                .authorities(new SimpleGrantedAuthority("ROLE_CENTRAL_ADMIN"), new SimpleGrantedAuthority("MASTER_DATA_WRITE"),
                        new SimpleGrantedAuthority("USER_WRITE"));
    }

    private String admin(String path, String json) throws Exception {
        MvcResult r = mockMvc.perform(post(ADMIN + path).with(adminToken()).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(), "$.id");
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

    private void scope(UUID userId, String districtId) throws Exception {
        mockMvc.perform(put(ADMIN + "/users/" + userId + "/scopes").with(adminToken()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"scopes\":[{\"districtId\":\"" + districtId + "\"}]}")).andExpect(status().isOk());
    }

    private String login(String name) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + prefix + name + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + JsonPath.<String>read(r.getResponse().getContentAsString(), "$.accessToken");
    }

    private UUID proposal(String number, String status, int hoursAgo, UUID state, UUID district, UUID department) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO proposals (id, proposal_number, title, project_type, status, version_no, state_id, district_id, "
                + "department_id, estimated_land_area_ha, description, planned_start_date, planned_end_date, owner_user_id, submitted_at) "
                + "VALUES (?, ?, 'DEMO IT proposal', 'STATE_HIGHWAY', ?, 1, ?, ?, ?, 10, 'DEMO', DATE '2027-01-01', DATE '2028-01-01', ?, "
                + "now() - (?::int * interval '1 hour'))", id, number, status, state, district, department, consultantId, hoursAgo);
        return id;
    }

    private MvcResult getJson(String token, String path) throws Exception {
        return mockMvc.perform(get(path).header("Authorization", token)).andReturn();
    }

    private MvcResult send(String token, String method, String path, String json) throws Exception {
        var request = "PUT".equals(method) ? put(path) : post(path);
        request = request.header("Authorization", token);
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

    private static String body(MvcResult r) throws Exception {
        return r.getResponse().getContentAsString();
    }

    private static long number(String json, String path) {
        return JsonPath.<Number>read(json, path).longValue();
    }

    private static long typeCount(String json, String type, String field) {
        List<Number> values = JsonPath.read(json, "$.byType[?(@.itemType=='" + type + "')]." + field);
        return values.get(0).longValue();
    }

    private long notificationsOf(UUID userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE recipient_user_id = ?::uuid", Long.class, userId);
    }

    // ------------------------------------------------------------------ tests

    @Test
    void overview_classifiesWaitingItems_byTheirLimits_withinTheCallersScope() throws Exception {
        MvcResult ov = getJson(authority, MON + "/sla?districtId=" + district1);
        expect(ov, 200);
        String j = body(ov);
        assertThat(typeCount(j, PROPOSALS, "onTime")).isEqualTo(1);
        assertThat(typeCount(j, PROPOSALS, "warning")).isEqualTo(1);
        assertThat(typeCount(j, PROPOSALS, "breach")).isEqualTo(1);
        assertThat(typeCount(j, WINDOW, "breach")).isEqualTo(1);
        assertThat(number(j, "$.onTime")).isEqualTo(1);
        assertThat(number(j, "$.warning")).isEqualTo(1);
        assertThat(number(j, "$.breach")).isEqualTo(2);
        assertThat(JsonPath.<List<Object>>read(j, "$.items")).hasSize(3);
        assertThat(JsonPath.<String>read(j, "$.items[0].level")).isEqualTo("BREACH");
        assertThat(j).contains("PRP-IT9A-" + suffix).contains("PRP-IT9B-" + suffix).contains("ACQ-IT9-" + suffix)
                .doesNotContain("PRP-IT9C-" + suffix).doesNotContain("PRP-IT9D-" + suffix);

//        expect(getJson(consultant, MON + "/sla?districtId=" + district1), 200);   // consultants have SLA_READ? see next line
          expect(getJson(consultant, MON + "/sla?districtId=" + district1), 403);
          expect(getJson(field2, MON + "/sla?districtId=" + district1), 404);
    }

    @Test
    void scan_notifiesTheRightRoles_once_andLogsEveryEscalation() throws Exception {
        expect(send(scrutiny, "POST", MON + "/sla/scan?districtId=" + district1, null), 403);
        expect(send(authority, "POST", MON + "/sla/scan?districtId=" + district1, null), 403);

        MvcResult scan = send(national, "POST", MON + "/sla/scan?districtId=" + district1, null);
        expect(scan, 200);
        assertThat(number(body(scan), "$.warningsRaised")).isEqualTo(3);     // 200h, 300h and the window case
        assertThat(number(body(scan), "$.breachesRaised")).isEqualTo(2);     // 300h and the window case
        assertThat(number(body(scan), "$.notificationsSent")).isEqualTo(5);  // scrutiny 3 (A, B, window), authority 2 (B, window)
        assertThat(notificationsOf(scrutinyId)).isEqualTo(3);
        assertThat(notificationsOf(authorityId)).isEqualTo(2);
        assertThat(notificationsOf(consultantId)).isZero();

        // the same scan again finds nothing new
        MvcResult again = send(national, "POST", MON + "/sla/scan?districtId=" + district1, null);
        expect(again, 200);
        assertThat(number(body(again), "$.warningsRaised")).isZero();
        assertThat(number(body(again), "$.notificationsSent")).isZero();
        assertThat(notificationsOf(scrutinyId)).isEqualTo(3);

        MvcResult log = getJson(authority, MON + "/sla/escalations?districtId=" + district1);
        expect(log, 200);
        assertThat(number(body(log), "$.totalRows")).isEqualTo(5);
        assertThat(body(log)).contains("\"level\":\"BREACH\"").contains("\"level\":\"WARNING\"").contains("ACQ-IT9-" + suffix);
        expect(getJson(field2, MON + "/sla/escalations?districtId=" + district1), 404);
        expect(getJson(authority, MON + "/sla/escalations?size=500"), 400);
    }

    @Test
    void rules_areChangedOnlyByAdministrators_withVersionChecks_andTheOverviewFollows() throws Exception {
        MvcResult rules = getJson(authority, MON + "/sla/rules");
        expect(rules, 200);
        assertThat(JsonPath.<List<Object>>read(body(rules), "$")).hasSize(8);
        List<Number> versions = JsonPath.read(body(rules), "$[?(@.itemType=='" + PROPOSALS + "')].rowVersion");
        long version = versions.get(0).longValue();

        String path = MON + "/sla/rules/" + PROPOSALS;
        String good = "{\"warnAfterHours\":400,\"breachAfterHours\":500,\"responsibleRole\":\"SCRUTINY_OFFICER\",\"escalateRole\":\"COMPETENT_AUTHORITY\",\"active\":true,\"rowVersion\":";
        expect(send(scrutiny, "PUT", path, good + version + "}"), 403);
        expect(send(national, "PUT", path, good + (version + 7) + "}"), 409);
        expect(send(national, "PUT", path, "{\"warnAfterHours\":50,\"breachAfterHours\":50,\"responsibleRole\":\"SCRUTINY_OFFICER\",\"active\":true,\"rowVersion\":" + version + "}"), 400);
        expect(send(national, "PUT", path, "{\"warnAfterHours\":10,\"breachAfterHours\":20,\"responsibleRole\":\"CITIZEN\",\"active\":true,\"rowVersion\":" + version + "}"), 400);
        expect(send(national, "PUT", path, "{\"warnAfterHours\":10}"), 400);
        expect(send(national, "PUT", MON + "/sla/rules/NOPE", good + version + "}"), 404);

        MvcResult updated = send(national, "PUT", path, good + version + "}");
        expect(updated, 200);
        assertThat(number(body(updated), "$.rowVersion")).isEqualTo(version + 1);

        // with the longer limits every proposal is on time again
        String j = body(getJson(authority, MON + "/sla?districtId=" + district1));
        assertThat(typeCount(j, PROPOSALS, "onTime")).isEqualTo(3);
        assertThat(typeCount(j, PROPOSALS, "warning")).isZero();
        assertThat(typeCount(j, PROPOSALS, "breach")).isZero();

        // settings are for administrators; payments are always simulated
        expect(getJson(scrutiny, MON + "/settings"), 403);
        MvcResult settings = getJson(national, MON + "/settings");
        expect(settings, 200);
        assertThat(body(settings)).contains("\"paymentMode\":\"SIMULATED\"").contains("Asia/Kolkata");
    }
}