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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import org.junit.jupiter.api.AfterAll;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Real database, real filter chain, real tokens, synthetic data only. */
@SpringBootTest
@ActiveProfiles("integration")
class AcquisitionIntegrationTest extends AbstractIsolatedPgIntegrationTest {

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
    private UUID projectId, secondProjectId, field1Id, managerId;
    private String manager, field1, field2, authority, consultant, finance;

    private static final Path STORAGE = newTempDir();

    private static Path newTempDir() {
        try {
            return Files.createTempDirectory("landnexus-it-acq");
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void storage(DynamicPropertyRegistry registry) {
        registry.add("landnexus.storage.dir", STORAGE::toString);
    }

    @AfterAll
    static void deleteStorage() throws java.io.IOException {
        try (var paths = Files.walk(STORAGE)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        }
    }

    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

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

        // V16 allows exactly one acquisition case per project, so tests that need a second case use this
        // separate project instead of creating a second case on the same project.
        UUID secondProposalId = UUID.randomUUID();
        secondProjectId = UUID.randomUUID();
        jdbc.update("INSERT INTO proposals (id, proposal_number, title, project_type, status, version_no, state_id, district_id, "
                        + "department_id, estimated_land_area_ha, description, planned_start_date, planned_end_date, owner_user_id, submitted_at) "
                        + "VALUES (?, ?, 'DEMO IT proposal 2', 'STATE_HIGHWAY', 'APPROVED', 1, ?, ?, ?, 8, 'DEMO', DATE '2027-01-01', DATE '2028-01-01', ?, now())",
                secondProposalId, "PRP-IT2-" + suffix, UUID.fromString(state), UUID.fromString(district1), UUID.fromString(department), con);
        jdbc.update("INSERT INTO projects (id, code, proposal_id, title, project_type, status, state_id, district_id, department_id, "
                        + "estimated_land_area_ha, owner_user_id, approved_by_user_id, approved_at) "
                        + "VALUES (?, ?, ?, 'DEMO IT project 2', 'STATE_HIGHWAY', 'ACTIVE', ?, ?, ?, 8, ?, ?, now())",
                secondProjectId, "PRJ-IT2-" + suffix, secondProposalId, UUID.fromString(state), UUID.fromString(district1),
                UUID.fromString(department), con, auth);
        jdbc.update("INSERT INTO project_villages (project_id, village_id) VALUES (?, ?)", secondProjectId, UUID.fromString(village1));
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        for (UUID pid : java.util.List.of(projectId, secondProjectId)) {
            String cases = "(SELECT id FROM acquisition_cases WHERE project_id = ?)";
            try {
                jdbc.execute("ALTER TABLE survey_photos DISABLE TRIGGER trg_survey_photos_append_only");
                jdbc.update("DELETE FROM survey_photos WHERE survey_id IN (SELECT id FROM field_surveys WHERE case_id IN " + cases + ")", pid);
            } finally {
                jdbc.execute("ALTER TABLE survey_photos ENABLE TRIGGER trg_survey_photos_append_only");
            }
            jdbc.update("DELETE FROM possession_records WHERE case_id IN " + cases, pid);
            jdbc.update("DELETE FROM award_parcels WHERE award_id IN (SELECT id FROM acquisition_awards WHERE case_id IN " + cases + ")", pid);
            jdbc.update("DELETE FROM acquisition_awards WHERE case_id IN " + cases, pid);
            jdbc.update("DELETE FROM objections WHERE case_id IN " + cases, pid);
            jdbc.update("DELETE FROM legal_notices WHERE case_id IN " + cases, pid);
            jdbc.update("DELETE FROM field_surveys WHERE case_id IN " + cases, pid);
            jdbc.update("DELETE FROM case_parcel_owners WHERE case_parcel_id IN (SELECT id FROM case_parcels WHERE case_id IN " + cases + ")", pid);
            jdbc.update("DELETE FROM case_parcels WHERE case_id IN " + cases, pid);
            jdbc.update("DELETE FROM case_villages WHERE case_id IN " + cases, pid);
            try {
                jdbc.execute("ALTER TABLE acquisition_case_history DISABLE TRIGGER trg_case_history_append_only");
                jdbc.update("DELETE FROM acquisition_case_history WHERE case_id IN " + cases, pid);
            } finally {
                jdbc.execute("ALTER TABLE acquisition_case_history ENABLE TRIGGER trg_case_history_append_only");
            }
            jdbc.update("DELETE FROM acquisition_cases WHERE project_id = ?", pid);
        }
        jdbc.update("DELETE FROM notifications WHERE recipient_user_id IN " + owners, like);
        jdbc.update("DELETE FROM project_villages WHERE project_id IN (?, ?)", projectId, secondProjectId);
        jdbc.update("DELETE FROM projects WHERE id IN (?, ?)", projectId, secondProjectId);
        jdbc.update("DELETE FROM proposals WHERE proposal_number IN (?, ?)", "PRP-IT-" + suffix, "PRP-IT2-" + suffix);
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

    private String newCase(UUID project) throws Exception {
        MvcResult r = call(manager, "POST", ACQ + "/cases", "{\"projectId\":\"" + project + "\",\"framework\":\"LARR_2013\"}");
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
        // V16: a project can have exactly one acquisition case; a second manual creation is a 409.
        expect(call(manager, "POST", ACQ + "/cases", "{\"projectId\":\"" + projectId + "\",\"framework\":\"LARR_2013\"}"), 409);
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
        String otherCase = newCase(secondProjectId);
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

    @Test
    void lifecycle_surveyPhotos_notice_objection_award_possession_closure() throws Exception {
        String caseId = newCase(projectId);
        String base = ACQ + "/cases/" + caseId;
        expect(call(manager, "PUT", base + "/villages", "{\"villageIds\":[\"" + village1 + "\"]}"), 200);
        String parcelId = parcel(village1, "DEMO-601", "2.0000");
        String caseParcelId = id(call(manager, "POST", base + "/parcels", "{\"parcelId\":\"" + parcelId + "\",\"areaToAcquireHa\":1.5}"));
        expect(call(manager, "POST", base + "/parcels/" + caseParcelId + "/assign", "{\"surveyorUserId\":\"" + field1Id + "\"}"), 200);
        expect(call(manager, "POST", base + "/start-survey", null), 200);
        String surveyId = id(call(field1, "POST", base + "/parcels/" + caseParcelId + "/surveys",
                "{\"surveyedOn\":\"2026-11-01\",\"measuredAreaHa\":2.0,\"gpsLatitude\":19.87,\"gpsLongitude\":75.34}"));

        // geo-tagged photos: only images, only the surveyor, GPS inside India
        String photos = base + "/surveys/" + surveyId + "/photos";
        expect(photo(field1, photos, "evil.png", "image/png", new byte[] {0x4D, 0x5A, 0, 0}, "19.87", "75.34"), 400);
        expect(photo(field1, photos, "doc.pdf", "application/pdf", "%PDF-1.4 x".getBytes(), "19.87", "75.34"), 400);
        expect(photo(field1, photos, "site.png", "image/png", PNG, "75.34", "19.87"), 400);
        expect(photo(manager, photos, "site.png", "image/png", PNG, "19.87", "75.34"), 403);
        expect(photo(field2, photos, "site.png", "image/png", PNG, "19.87", "75.34"), 404);
        MvcResult photo = photo(field1, photos, "site.png", "image/png", PNG, "19.87", "75.34");
        expect(photo, 201);
        assertThat(photo.getResponse().getContentAsString()).doesNotContain("stored").doesNotContain(".bin");
        MvcResult download = call(finance, "GET", photos + "/" + id(photo) + "/download", null);
        expect(download, 200);
        assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(PNG);
        assertThat(download.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");

        String survey = base + "/surveys/" + surveyId;
        expect(call(manager, "POST", survey + "/verify", null), 200);
        expect(photo(field1, photos, "late.png", "image/png", PNG, "19.87", "75.34"), 409);
        expect(call(manager, "POST", base + "/complete-verification", null), 200);

        // notice and the objection period (dates in the past: the notice was already published)
        String today = LocalDate.now().toString();
        String issued = LocalDate.now().minusDays(60).toString();
        String deadline = LocalDate.now().minusDays(30).toString();
        expect(call(manager, "POST", base + "/issue-notification", null), 403);
        expect(call(authority, "POST", base + "/issue-notification", null), 400);
        expect(call(manager, "POST", base + "/notices", "{\"noticeType\":\"PRELIMINARY_NOTIFICATION\",\"referenceNumber\":\"DEMO-GZ-1\",\"issuedOn\":\"" + issued + "\"}"), 400);
        expect(call(manager, "POST", base + "/notices", "{\"noticeType\":\"AWARD_NOTICE\",\"referenceNumber\":\"DEMO-GZ-9\",\"issuedOn\":\"" + issued + "\"}"), 409);
//        expect(call(consultant, "POST", base + "/notices", "{}"), 403);
        expect(call(consultant, "POST", base + "/notices",
                "{\"noticeType\":\"PRELIMINARY_NOTIFICATION\","
                        + "\"referenceNumber\":\"CONSULTANT-TEST-1\","
                        + "\"issuedOn\":\"" + issued + "\","
                        + "\"objectionDeadline\":\"" + deadline + "\"}"), 403);
        expect(call(manager, "POST", base + "/notices", "{\"noticeType\":\"PRELIMINARY_NOTIFICATION\",\"referenceNumber\":\"DEMO-GZ-1\",\"issuedOn\":\""
                + issued + "\",\"objectionDeadline\":\"" + deadline + "\"}"), 201);
        expect(call(manager, "POST", base + "/notices", "{\"noticeType\":\"PRELIMINARY_NOTIFICATION\",\"referenceNumber\":\"DEMO-GZ-1\",\"issuedOn\":\""
                + issued + "\",\"objectionDeadline\":\"" + deadline + "\"}"), 409);
        expect(call(authority, "POST", base + "/issue-notification", null), 200);

        // objections: only inside the period; the registrar cannot decide; the window stays open until all are decided
        String objections = base + "/objections";
        expect(call(manager, "POST", objections, "{\"caseParcelId\":\"" + caseParcelId + "\",\"receivedOn\":\"" + today + "\",\"grounds\":\"DEMO late\"}"), 400);
        String received = LocalDate.now().minusDays(45).toString();
        MvcResult objection = call(manager, "POST", objections, "{\"caseParcelId\":\"" + caseParcelId + "\",\"receivedOn\":\"" + received
                + "\",\"grounds\":\"DEMO grounds\",\"objectorReference\":\"DEMO objector\"}");
        expect(objection, 201);
        String objectionId = id(objection);
        expect(call(manager, "POST", base + "/close-objection-window", null), 400);
        expect(call(manager, "POST", objections + "/" + objectionId + "/decide", "{\"outcome\":\"DISMISSED\",\"remarks\":\"x\"}"), 403);
        expect(call(authority, "POST", objections + "/" + objectionId + "/decide", "{\"outcome\":\"OPEN\",\"remarks\":\"x\"}"), 400);
        expect(call(authority, "POST", objections + "/" + objectionId + "/decide", "{\"outcome\":\"DISMISSED\",\"remarks\":\"DEMO: no merit\"}"), 200);
        expect(call(authority, "POST", objections + "/" + objectionId + "/decide", "{\"outcome\":\"ACCEPTED\",\"remarks\":\"again\"}"), 409);
        // the objector reference is personal data: visible to a manager (LANDOWNER_READ), hidden from finance
        mockMvc.perform(get(objections).header("Authorization", finance)).andExpect(jsonPath("$[0].objectorReference").doesNotExist());
        mockMvc.perform(get(objections).header("Authorization", manager)).andExpect(jsonPath("$[0].objectorReference").value("DEMO objector"));
        expect(call(manager, "POST", base + "/close-objection-window", null), 200);

        // award: declared by the competent authority, one line per parcel, no money
        String award = "{\"awardNumber\":\"DEMO-AW-1\",\"awardDate\":\"" + LocalDate.now().minusDays(40) + "\"}";
        expect(call(manager, "POST", base + "/award", award), 403);
        expect(call(authority, "POST", base + "/award", award), 400);
        MvcResult declared = call(authority, "POST", base + "/award",
                "{\"awardNumber\":\"DEMO-AW-1\",\"awardDate\":\"" + LocalDate.now().minusDays(10) + "\"}");
        expect(declared, 201);
        assertThat(declared.getResponse().getContentAsString()).contains("\"awardNumber\":\"DEMO-AW-1\"").contains("\"awardedAreaHa\":1.5");
        expect(call(authority, "POST", base + "/cancel", "{\"reason\":\"too late\"}"), 409);

        // possession: after the award date, once per parcel; completing needs every parcel
        String possessions = base + "/possessions";
        expect(call(manager, "POST", base + "/complete-possession", null), 400);
        expect(call(manager, "POST", possessions, "{\"caseParcelId\":\"" + caseParcelId + "\",\"possessionDate\":\"" + LocalDate.now().minusDays(20)
                + "\",\"possessionType\":\"PHYSICAL\"}"), 400);
        String possession = "{\"caseParcelId\":\"" + caseParcelId + "\",\"possessionDate\":\"" + LocalDate.now().minusDays(5) + "\",\"possessionType\":\"PHYSICAL\"}";
        expect(call(manager, "POST", possessions, possession), 201);
        expect(call(manager, "POST", possessions, possession), 409);
        expect(call(manager, "POST", base + "/complete-possession", null), 200);

        // closure frees the parcel for a later case
        expect(call(manager, "POST", base + "/close", null), 403);
        expect(call(authority, "POST", base + "/close", "{\"reason\":\"DEMO: acquisition completed\"}"), 200);
        String second = newCase(secondProjectId);
        expect(call(manager, "PUT", ACQ + "/cases/" + second + "/villages", "{\"villageIds\":[\"" + village1 + "\"]}"), 200);
        expect(call(manager, "POST", ACQ + "/cases/" + second + "/parcels", "{\"parcelId\":\"" + parcelId + "\",\"areaToAcquireHa\":0.5}"), 201);

        mockMvc.perform(get(base + "/history").header("Authorization", manager)).andExpect(jsonPath("$.length()").value(8));
    }

    private MvcResult photo(String token, String path, String filename, String type, byte[] content, String lat, String lon) throws Exception {
        return mockMvc.perform(multipart(path).file(new MockMultipartFile("file", filename, type, content))
                .param("latitude", lat).param("longitude", lon).header("Authorization", token)).andReturn();
    }
}