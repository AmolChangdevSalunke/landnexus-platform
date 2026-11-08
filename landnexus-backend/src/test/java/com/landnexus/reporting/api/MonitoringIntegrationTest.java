package com.landnexus.reporting.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
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
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
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

/** Real database, real filter chain, real tokens. Exact counts are asserted by filtering on the test's own district. */
@SpringBootTest
class MonitoringIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String LR = "/api/v1/land-records";
    private static final String MON = "/api/v1/monitoring";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix, prefix, stateCode, state, district1;
    private UUID projectId;
    private String field1, field2, finance, consultant, national;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it8-" + suffix.toLowerCase(Locale.ROOT) + "-";
        stateCode = "ITM" + suffix;

        state = admin("/states", "{\"code\":\"" + stateCode + "\",\"name\":\"Monitoring Test State\"}");
        district1 = admin("/districts", "{\"code\":\"D1\",\"name\":\"District One\",\"stateId\":\"" + state + "\"}");
        String district2 = admin("/districts", "{\"code\":\"D2\",\"name\":\"District Two\",\"stateId\":\"" + state + "\"}");
        String taluka1 = admin("/talukas", "{\"code\":\"T1\",\"name\":\"Taluka One\",\"districtId\":\"" + district1 + "\"}");
        String village1 = admin("/villages", "{\"code\":\"V1\",\"name\":\"Village One\",\"talukaId\":\"" + taluka1 + "\"}");
        String ministry = admin("/ministries", "{\"code\":\"ITMM" + suffix + "\",\"name\":\"Test Ministry\"}");
        String department = admin("/departments", "{\"code\":\"ITMD" + suffix + "\",\"name\":\"Test Department\",\"ministryId\":\""
                + ministry + "\",\"level\":\"STATE\"}");

        UUID f1 = user("field1", "FIELD_OFFICER");
        UUID f2 = user("field2", "FIELD_OFFICER");
        UUID fin = user("finance", "FINANCE_OFFICER");
        UUID con = user("consultant", "CONSULTANT");
        user("national", "SUPER_ADMIN");
        scope(f1, district1);
        scope(f2, district2);
        scope(fin, district1);
        scope(con, district1);
        field1 = login("field1");
        field2 = login("field2");
        finance = login("finance");
        consultant = login("consultant");
        national = login("national");

        // two proposals (one approved with its project, one waiting for scrutiny), two parcels, one open case with one parcel
        UUID approvedProposal = UUID.randomUUID();
        UUID waitingProposal = UUID.randomUUID();
        projectId = UUID.randomUUID();
        String insertProposal = "INSERT INTO proposals (id, proposal_number, title, project_type, status, version_no, state_id, district_id, "
                + "department_id, estimated_land_area_ha, description, planned_start_date, planned_end_date, owner_user_id, submitted_at) "
                + "VALUES (?, ?, 'DEMO IT proposal', 'STATE_HIGHWAY', ?, 1, ?, ?, ?, 10, 'DEMO', DATE '2027-01-01', DATE '2028-01-01', ?, now())";
        jdbc.update(insertProposal, approvedProposal, "PRP-IT8A-" + suffix, "APPROVED", UUID.fromString(state), UUID.fromString(district1),
                UUID.fromString(department), con);
        jdbc.update(insertProposal, waitingProposal, "PRP-IT8B-" + suffix, "SUBMITTED", UUID.fromString(state), UUID.fromString(district1),
                UUID.fromString(department), con);
        jdbc.update("INSERT INTO projects (id, code, proposal_id, title, project_type, status, state_id, district_id, department_id, "
                        + "estimated_land_area_ha, owner_user_id, approved_by_user_id, approved_at) "
                        + "VALUES (?, ?, ?, 'DEMO IT project', 'STATE_HIGHWAY', 'ACTIVE', ?, ?, ?, 10, ?, ?, now())",
                projectId, "PRJ-IT8-" + suffix, approvedProposal, UUID.fromString(state), UUID.fromString(district1),
                UUID.fromString(department), con, con);
        jdbc.update("INSERT INTO project_villages (project_id, village_id) VALUES (?, ?)", projectId, UUID.fromString(village1));

        String p1 = parcel(village1, "DEMO-901", "1.2");
        parcel(village1, "DEMO-902", "2.0");
        UUID caseId = UUID.randomUUID();
        jdbc.update("INSERT INTO acquisition_cases (id, case_number, project_id, state_id, district_id, framework, status) "
                        + "VALUES (?, ?, ?, ?, ?, 'LARR_2013', 'SURVEY_IN_PROGRESS')", caseId, "ACQ-IT8-" + suffix, projectId,
                UUID.fromString(state), UUID.fromString(district1));
        jdbc.update("INSERT INTO case_parcels (id, case_id, parcel_id, village_id, area_to_acquire_ha) VALUES (?, ?, ?, ?, 1.5)",
                UUID.randomUUID(), caseId, UUID.fromString(p1), UUID.fromString(village1));
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        String parcels = "(SELECT p.id FROM land_parcels p JOIN districts d ON d.id = p.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)";
        jdbc.update("DELETE FROM case_parcels WHERE case_id IN (SELECT id FROM acquisition_cases WHERE project_id = ?)", projectId);
        jdbc.update("DELETE FROM acquisition_cases WHERE project_id = ?", projectId);
        jdbc.update("DELETE FROM project_villages WHERE project_id = ?", projectId);
        jdbc.update("DELETE FROM projects WHERE id = ?", projectId);
        jdbc.update("DELETE FROM proposals WHERE proposal_number IN (?, ?)", "PRP-IT8A-" + suffix, "PRP-IT8B-" + suffix);
        jdbc.update("DELETE FROM land_parcels WHERE id IN " + parcels, stateCode);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITMD" + suffix);
        jdbc.update("DELETE FROM ministries WHERE code = ?", "ITMM" + suffix);
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

    private String parcel(String village, String gat, String area) throws Exception {
        MvcResult r = call(field1, LR + "/parcels", "POST", "{\"villageId\":\"" + village + "\",\"gatNumber\":\"" + gat + "\",\"areaHa\":" + area
                + ",\"classification\":\"AGRICULTURAL_DRY\",\"landUse\":\"CULTIVATION\"}");
        expect(r, 201);
        return JsonPath.read(r.getResponse().getContentAsString(), "$.id");
    }

    private MvcResult call(String token, String path, String method, String json) throws Exception {
        var request = "POST".equals(method) ? post(path) : get(path);
        request = request.header("Authorization", token);
        if (json != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mockMvc.perform(request).andReturn();
    }

//    private MvcResult get(String token, String path) throws Exception {
//        return call(token, path, "GET", null);
//    }

    private MvcResult getRequest(String token, String path) throws Exception {
        return call(token, path, "GET", null);
    }

    private void expect(MvcResult r, int code) throws Exception {
        assertThat(r.getResponse().getStatus())
                .as("%s %s -> body: %s", r.getRequest().getMethod(), r.getRequest().getRequestURI(), r.getResponse().getContentAsString())
                .isEqualTo(code);
    }

    private static String body(MvcResult r) throws Exception {
        return r.getResponse().getContentAsString();
    }

    private static long num(String json, String path) {
        return JsonPath.<Number>read(json, path).longValue();
    }

    private static double dec(String json, String path) {
        return JsonPath.<Number>read(json, path).doubleValue();
    }

    // ------------------------------------------------------------------ tests

    @Test
    void dashboard_countsOnlyWhatTheCallerMaySee_hidesMoneyWithoutPermission_andFollowsTheLevel() throws Exception {
        MvcResult district = getRequest(finance, MON + "/dashboard?districtId=" + district1);
        expect(district, 200);
        String j = body(district);
        assertThat(JsonPath.<String>read(j, "$.level")).isEqualTo("DISTRICT");
        assertThat(num(j, "$.proposals.total")).isEqualTo(2);
        assertThat(num(j, "$.proposals.byStatus.APPROVED")).isEqualTo(1);
        assertThat(num(j, "$.proposals.byStatus.SUBMITTED")).isEqualTo(1);
        assertThat(num(j, "$.proposals.inReview")).isEqualTo(1);
        assertThat(num(j, "$.projects.total")).isEqualTo(1);
        assertThat(dec(j, "$.projects.estimatedLandAreaHa")).isCloseTo(10.0, within(0.0001));
        assertThat(num(j, "$.land.activeParcels")).isEqualTo(2);
        assertThat(dec(j, "$.land.totalAreaHa")).isCloseTo(3.2, within(0.0001));
        assertThat(num(j, "$.land.parcelsWithBoundary")).isZero();
        assertThat(num(j, "$.acquisition.totalCases")).isEqualTo(1);
        assertThat(num(j, "$.acquisition.openCases")).isEqualTo(1);
        assertThat(num(j, "$.acquisition.parcelsIdentified")).isEqualTo(1);
        assertThat(dec(j, "$.acquisition.areaToAcquireHa")).isCloseTo(1.5, within(0.0001));
        assertThat(JsonPath.<String>read(j, "$.finance.paymentMode")).isEqualTo("SIMULATED");
        assertThat(JsonPath.<List<Object>>read(j, "$.trend")).hasSize(6);
        assertThat(num(j, "$.trend[5].proposalsSubmitted")).isEqualTo(2);
        assertThat(num(j, "$.trend[5].casesOpened")).isEqualTo(1);
        assertThat(JsonPath.<List<Object>>read(j, "$.districts")).hasSize(1);
        assertThat(JsonPath.<String>read(j, "$.districts[0].district")).isEqualTo("District One");

        // the same numbers at state level (the state belongs to this test only)
        MvcResult stateLevel = getRequest(national, MON + "/dashboard?stateId=" + state);
        expect(stateLevel, 200);
        assertThat(JsonPath.<String>read(body(stateLevel), "$.level")).isEqualTo("STATE");
        assertThat(num(body(stateLevel), "$.proposals.total")).isEqualTo(2);

        // a field officer has no valuation permission: no money, but the counts are there
        MvcResult noMoney = getRequest(field1, MON + "/dashboard");
        expect(noMoney, 200);
        assertThat(JsonPath.<String>read(body(noMoney), "$.level")).isEqualTo("SCOPED");
        assertThat(body(noMoney)).contains("\"finance\":null");
        assertThat(num(body(noMoney), "$.proposals.total")).isEqualTo(2);

        // another district sees nothing of it, and cannot ask for it
        MvcResult other = getRequest(field2, MON + "/dashboard");
        expect(other, 200);
        assertThat(num(body(other), "$.proposals.total")).isZero();
        expect(getRequest(field2, MON + "/dashboard?districtId=" + district1), 404);
        expect(getRequest(field2, MON + "/dashboard?stateId=" + state), 200);   // the state exists for them through district two
        expect(getRequest(national, MON + "/dashboard?stateId=" + UUID.randomUUID()), 404);

        // national and permissions
        MvcResult nat = getRequest(national, MON + "/dashboard");
        expect(nat, 200);
        assertThat(JsonPath.<String>read(body(nat), "$.level")).isEqualTo("NATIONAL");
        expect(getRequest(consultant, MON + "/dashboard"), 403);
    }

    @Test
    void reports_areScoped_filtered_exportedWithABom_andProtected() throws Exception {
        // catalogue: finance may run the compensation report, a field officer may not
        assertThat(JsonPath.<List<String>>read(body(getRequest(finance, MON + "/reports")), "$[*].code"))
                .containsExactly("PROJECTS", "ACQUISITION_CASES", "COMPENSATION");
        assertThat(JsonPath.<List<String>>read(body(getRequest(field1, MON + "/reports")), "$[*].code"))
                .containsExactly("PROJECTS", "ACQUISITION_CASES");
        expect(getRequest(consultant, MON + "/reports"), 403);

        MvcResult projects = getRequest(finance, MON + "/reports/PROJECTS?districtId=" + district1);
        expect(projects, 200);
        assertThat(num(body(projects), "$.totalRows")).isEqualTo(1);
        assertThat(JsonPath.<String>read(body(projects), "$.rows[0].project_code")).isEqualTo("PRJ-IT8-" + suffix);
        assertThat(JsonPath.<List<Object>>read(body(projects), "$.columns")).hasSize(8);
        assertThat(num(getRequest(finance, MON + "/reports/PROJECTS?districtId=" + district1 + "&status=ACTIVE").getResponse().getContentAsString(), "$.totalRows")).isEqualTo(1);
        assertThat(num(getRequest(finance, MON + "/reports/PROJECTS?districtId=" + district1 + "&status=CLOSED").getResponse().getContentAsString(), "$.totalRows")).isZero();

        MvcResult cases = getRequest(finance, MON + "/reports/ACQUISITION_CASES?districtId=" + district1);
        expect(cases, 200);
        assertThat(num(body(cases), "$.rows[0].parcels")).isEqualTo(1);
        assertThat(dec(body(cases), "$.rows[0].area_to_acquire_ha")).isCloseTo(1.5, within(0.0001));

        expect(getRequest(finance, MON + "/reports/COMPENSATION?districtId=" + district1), 200);
        expect(getRequest(field1, MON + "/reports/COMPENSATION"), 403);
        expect(getRequest(finance, MON + "/reports/NOPE"), 404);
        expect(getRequest(field2, MON + "/reports/PROJECTS?districtId=" + district1), 404);
        expect(getRequest(finance, MON + "/reports/PROJECTS?size=500"), 400);

        // a hostile status filter never reaches the database as SQL
        MvcResult hostile = mockMvc.perform(get(MON + "/reports/PROJECTS").header("Authorization", finance)
                .param("status", "x'; DROP TABLE users; --")).andReturn();
        expect(hostile, 400);

        // CSV: only roles with REPORT_EXPORT, with a byte order mark and safe headers
        expect(getRequest(field1, MON + "/reports/PROJECTS/export.csv?districtId=" + district1), 403);
        MvcResult csv = getRequest(finance, MON + "/reports/PROJECTS/export.csv?districtId=" + district1);
        expect(csv, 200);
        byte[] bytes = csv.getResponse().getContentAsByteArray();
        assertThat(bytes[0] & 0xFF).isEqualTo(0xEF);
        assertThat(bytes[1] & 0xFF).isEqualTo(0xBB);
        assertThat(bytes[2] & 0xFF).isEqualTo(0xBF);
        String text = new String(bytes, StandardCharsets.UTF_8);
        assertThat(text).contains("Project code,Title").contains("PRJ-IT8-" + suffix);
        assertThat(csv.getResponse().getContentType()).startsWith("text/csv");
        assertThat(csv.getResponse().getHeader("Content-Disposition")).contains("attachment").contains("projects-");
        assertThat(csv.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(csv.getResponse().getHeader("Cache-Control")).contains("no-store");
        expect(getRequest(field2, MON + "/reports/PROJECTS/export.csv?districtId=" + district1), 403);
    }
}