package com.landnexus.acquisition.api;

import static org.assertj.core.api.Assertions.assertThat;
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

/** Real database, real filter chain, real tokens, synthetic data only. */
@SpringBootTest
class AcquisitionIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String ACQ = "/api/v1/acquisition";
    private static final String LR = "/api/v1/land-records";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix, prefix, stateCode;
    private String district1, village1, village2;
    private UUID projectId, field1Id, managerId;
    private String manager, field1, field2, authority, consultant, finance;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it5-" + suffix.toLowerCase(Locale.ROOT) + "-";
        stateCode = "ITQ" + suffix;

        String state = admin("/states", "{\"code\":\"" + stateCode + "\",\"name\":\"Acquisition Test State\"}");
        district1 = admin("/districts", "{\"code\":\"D1\",\"name\":\"District One\",\"stateId\":\"" + state + "\"}");
        String district2 = admin("/districts", "{\"code\":\"D2\",\"name\":\"District Two\",\"stateId\":\"" + state + "\"}");
        String taluka1 = admin("/talukas", "{\"code\":\"T1\",\"name\":\"Taluka One\",\"districtId\":\"" + district1 + "\"}");
        String taluka2 = admin("/talukas", "{\"code\":\"T2\",\"name\":\"Taluka Two\",\"districtId\":\"" + district2 + "\"}");
        village1 = admin("/villages", "{\"code\":\"V1\",\"name\":\"Village One\",\"talukaId\":\"" + taluka1 + "\"}");
        village2 = admin("/villages", "{\"code\":\"V2\",\"name\":\"Village Two\",\"talukaId\":\"" + taluka2 + "\"}");
        String ministry = admin("/ministries", "{\"code\":\"ITQM" + suffix + "\",\"name\":\"Test Ministry\"}");
        String department = admin("/departments", "{\"code\":\"ITQD" + suffix + "\",\"name\":\"Test Department\",\"ministryId\":\""
                + ministry + "\",\"level\":\"STATE\"}");

        managerId = user("manager", "SCRUTINY_OFFICER");
        field1Id = user("field1", "FIELD_OFFICER");
        UUID f2 = user("field2", "FIELD_OFFICER");
        UUID auth = user("authority", "COMPETENT_AUTHORITY");
        UUID con = user("consultant", "CONSULTANT");
        UUID fin = user("finance", "FINANCE_OFFICER");
        for (UUID u : new UUID[] {managerId, field1Id, auth, con, fin}) {
            scope(u, district1);
        }
        scope(f2, district2);
        manager = login("manager");
        field1 = login("field1");
        field2 = login("field2");
        authority = login("authority");
        consultant = login("consultant");
        finance = login("finance");

        // an approved proposal and its project, created directly in the database (this test is about Module 4)
        UUID proposalId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        jdbc.update("INSERT INTO proposals (id, proposal_number, title, project_type, status, version_no, state_id, district_id, "
                        + "department_id, estimated_land_area_ha, description, planned_start_date, planned_end_date, owner_user_id, submitted_at) "
                        + "VALUES (?, ?, 'DEMO IT proposal', 'STATE_HIGHWAY', 'APPROVED', 1, ?, ?, ?, 10, 'DEMO', DATE '2027-01-01', DATE '2028-01-01', ?, now())",
                proposalId, "PRP-IT-" + suffix, UUID.fromString(state), UUID.fromString(district1), UUID.fromString(department), con);
        jdbc.update("INSERT INTO projects (id, code, proposal_id, title, project_type, status, state_id, district_id, department_id, "
                        + "estimated_land_area_ha, owner_user_id, approved_by_user_id, approved_at) "
                        + "VALUES (?, ?, ?, 'DEMO IT project', 'STATE_HIGHWAY', 'ACTIVE', ?, ?, ?, 10, ?, ?, now())",
                projectId, "PRJ-IT-" + suffix, proposalId, UUID.fromString(state), UUID.fromString(district1),
                UUID.fromString(department), con, auth);
        jdbc.update("INSERT INTO project_villages (project_id, village_id) VALUES (?, ?)", projectId, UUID.fromString(village1));
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        String cases = "(SELECT id FROM acquisition_cases WHERE project_id = ?)";
        jdbc.update("DELETE FROM field_surveys WHERE case_id IN " + cases, projectId);
        jdbc.update("DELETE FROM case_parcel_owners WHERE case_parcel_id IN (SELECT id FROM case_parcels WHERE case_id IN " + cases + ")", projectId);
        jdbc.update("DELETE FROM case_parcels WHERE case_id IN " + cases, projectId);
        jdbc.update("DELETE FROM case_villages WHERE case_id IN " + cases, projectId);
        try {
            jdbc.execute("ALTER TABLE acquisition_case_history DISABLE TRIGGER trg_case_history_append_only");
            jdbc.update("DELETE FROM acquisition_case_history WHERE case_id IN " + cases, projectId);
        } finally {
            jdbc.execute("ALTER TABLE acquisition_case_history ENABLE TRIGGER trg_case_history_append_only");
        }
        jdbc.update("DELETE FROM acquisition_cases WHERE project_id = ?", projectId);
        jdbc.update("DELETE FROM notifications WHERE recipient_user_id IN " + owners, like);
        jdbc.update("DELETE FROM project_villages WHERE project_id = ?", projectId);
        jdbc.update("DELETE FROM projects WHERE id = ?", projectId);
        jdbc.update("DELETE FROM proposals WHERE proposal_number = ?", "PRP-IT-" + suffix);
        String parcels = "(SELECT p.id FROM land_parcels p JOIN districts d ON d.id = p.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)";
        jdbc.update("DELETE FROM parcel_ownerships WHERE parcel_id IN " + parcels, stateCode);
        jdbc.update("DELETE FROM land_parcels WHERE id IN " + parcels, stateCode);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITQD" + suffix);
        jdbc.update("DELETE FROM ministries WHERE code = ?", "ITQM" + suffix);
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

    private MvcResult call(String token, String method, String path, String json) throws Exception {
        var request = "POST".equals(method) ? post(path) : "PUT".equals(method) ? put(path)
                : "DELETE".equals(method) ? org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(path) : get(path);
        request = request.header("Authorization", token);
        if (json != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mockMvc.perform(request).andReturn();
    }

    private void expect(MvcResult r, int code) {
        assertThat(r.getResponse().getStatus()).as("%s %s", r.getRequest().getMethod(), r.getRequest().getRequestURI()).isEqualTo(code);
    }

    private String id(MvcResult r) throws Exception {
        return JsonPath.read(r.getResponse().getContentAsString(), "$.id");
    }

    private String parcel(String village, String gat, String area) throws Exception {
        MvcResult r = call(field1, "POST", LR + "/parcels", "{\"villageId\":\"" + village + "\",\"gatNumber\":\"" + gat + "\",\"areaHa\":"
                + area + ",\"classification\":\"AGRICULTURAL_DRY\",\"landUse\":\"CULTIVATION\"}");
        expect(r, 201);
        return id(r);
    }

    private String newCase() throws Exception {
        MvcResult r = call(manager, "POST", ACQ + "/cases", "{\"projectId\":\"" + projectId + "\",\"framework\":\"LARR_2013\"}");
        expect(r, 201);
        return id(r);
    }

    // ------------------------------------------------------------------ test

    @Test
    void case_fromProject_throughSurveyAndVerification_toCancellation() throws Exception {
        // creation, permissions and scope
        expect(call(field1, "POST", ACQ + "/cases", "{\"projectId\":\"" + projectId + "\",\"framework\":\"LARR_2013\"}"), 403);
        expect(call(consultant, "POST", ACQ + "/cases", "{\"projectId\":\"" + projectId + "\",\"framework\":\"LARR_2013\"}"), 403);
        expect(call(manager, "POST", ACQ + "/cases", "{\"projectId\":\"" + UUID.randomUUID() + "\",\"framework\":\"LARR_2013\"}"), 400);
        MvcResult created = call(manager, "POST", ACQ + "/cases", "{\"projectId\":\"" + projectId + "\",\"framework\":\"LARR_2013\",\"description\":\"DEMO\"}");
        expect(created, 201);
        String caseId = id(created);
        assertThat(created.getResponse().getContentAsString()).contains("\"caseNumber\":\"ACQ-").contains("START_SURVEY");
        expect(call(field2, "GET", ACQ + "/cases/" + caseId, null), 404);
        expect(call(finance, "GET", ACQ + "/cases/" + caseId, null), 200);

        // affected villages must come from the project
        expect(call(manager, "PUT", ACQ + "/cases/" + caseId + "/villages", "{\"villageIds\":[\"" + village2 + "\"]}"), 400);
        expect(call(manager, "PUT", ACQ + "/cases/" + caseId + "/villages", "{\"villageIds\":[\"" + village1 + "\"]}"), 200);

        // affected parcels
        String p1 = parcel(village1, "DEMO-501", "2.0000");
        String identify = ACQ + "/cases/" + caseId + "/parcels";
        expect(call(manager, "POST", identify, "{\"parcelId\":\"" + p1 + "\",\"areaToAcquireHa\":5}"), 400);
        MvcResult cp = call(manager, "POST", identify, "{\"parcelId\":\"" + p1 + "\",\"areaToAcquireHa\":1.5}");
        expect(cp, 201);
        String caseParcelId = id(cp);
        expect(call(manager, "POST", identify, "{\"parcelId\":\"" + p1 + "\",\"areaToAcquireHa\":1}"), 409);
        String otherCase = newCase();
        expect(call(manager, "PUT", ACQ + "/cases/" + otherCase + "/villages", "{\"villageIds\":[\"" + village1 + "\"]}"), 200);
        expect(call(manager, "POST", ACQ + "/cases/" + otherCase + "/parcels", "{\"parcelId\":\"" + p1 + "\",\"areaToAcquireHa\":1}"), 409);

        // stages cannot be skipped, and surveying needs a parcel
        expect(call(manager, "POST", ACQ + "/cases/" + caseId + "/complete-verification", null), 409);
        expect(call(manager, "POST", ACQ + "/cases/" + otherCase + "/start-survey", null), 400);
        expect(call(manager, "POST", ACQ + "/cases/" + caseId + "/start-survey", null), 200);

        // the surveyor must be an eligible field officer; completing needs a verified survey
        expect(call(manager, "POST", ACQ + "/cases/" + caseId + "/parcels/" + caseParcelId + "/assign", "{\"surveyorUserId\":\"" + managerId + "\"}"), 400);
        expect(call(manager, "POST", ACQ + "/cases/" + caseId + "/parcels/" + caseParcelId + "/assign", "{\"surveyorUserId\":\"" + field1Id + "\"}"), 200);
        expect(call(manager, "POST", ACQ + "/cases/" + caseId + "/complete-verification", null), 400);

        // surveying: only the assigned surveyor, valid GPS, notes for a big variance, one live survey at a time
        String surveys = ACQ + "/cases/" + caseId + "/parcels/" + caseParcelId + "/surveys";
        String ok = "{\"surveyedOn\":\"2026-11-01\",\"measuredAreaHa\":2.05,\"gpsLatitude\":19.876543,\"gpsLongitude\":75.343210}";
        expect(call(field2, "POST", surveys, ok), 404);
        expect(call(manager, "POST", surveys, ok), 403);
        expect(call(field1, "POST", surveys, "{\"surveyedOn\":\"2026-11-01\",\"measuredAreaHa\":2.05,\"gpsLatitude\":75.34,\"gpsLongitude\":19.87}"), 400);
        expect(call(field1, "POST", surveys, "{\"surveyedOn\":\"2026-11-01\",\"measuredAreaHa\":3.5,\"gpsLatitude\":19.87,\"gpsLongitude\":75.34}"), 400);
        MvcResult s = call(field1, "POST", surveys, ok);
        expect(s, 201);
        String surveyId = id(s);
        assertThat(s.getResponse().getContentAsString()).contains("\"variancePercent\":2.5");
        expect(call(field1, "POST", surveys, ok), 409);

        // verification: not the surveyor, remarks needed to reject
        String verify = ACQ + "/cases/" + caseId + "/surveys/" + surveyId;
        expect(call(field1, "POST", verify + "/verify", null), 403);
        expect(call(manager, "POST", verify + "/reject", "{\"remarks\":\"\"}"), 400);
        expect(call(manager, "POST", verify + "/verify", "{\"remarks\":\"Checked on site\"}"), 200);

        mockMvc.perform(get(ACQ + "/cases/" + caseId + "/verification-report").header("Authorization", finance))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalParcels").value(1))
                .andExpect(jsonPath("$.verified").value(1))
                .andExpect(jsonPath("$.parcels[0].surveyState").value("VERIFIED"));
        expect(call(manager, "POST", ACQ + "/cases/" + caseId + "/complete-verification", null), 200);

        // cancelling is the competent authority's decision and needs a reason; it frees the parcel for a new case
        expect(call(manager, "POST", ACQ + "/cases/" + caseId + "/cancel", "{\"reason\":\"x\"}"), 403);
        expect(call(authority, "POST", ACQ + "/cases/" + caseId + "/cancel", "{\"reason\":\"\"}"), 400);
        expect(call(authority, "POST", ACQ + "/cases/" + caseId + "/cancel", "{\"reason\":\"DEMO: project withdrawn\"}"), 200);
        expect(call(manager, "POST", ACQ + "/cases/" + otherCase + "/parcels", "{\"parcelId\":\"" + p1 + "\",\"areaToAcquireHa\":1}"), 201);

        mockMvc.perform(get(ACQ + "/cases/" + caseId + "/history").header("Authorization", manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));
    }
}