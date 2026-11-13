package com.landnexus.projects.api;

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
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Real database, real filter chain, real tokens: the whole consultant proposal workflow.
 * Proposal history and versions are append-only, so cleanup switches those two triggers off briefly
 * (test-only, in a finally block). Audit rows tagged "it-actor" stay behind by design.
 * Runs only against isolated disposable PostgreSQL (never landnexus_dev).
 */
@SpringBootTest
@ActiveProfiles("integration")
class ProposalWorkflowIntegrationTest extends AbstractIsolatedPgIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String PROPOSALS = "/api/v1/projects/proposals";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix;
    private String prefix;

    private String stateId;
    private String district1;
    private String district2;
    private String taluka1;
    private String village1;
    private String village2;
    private String departmentId;

    private String consultantToken;
    private String consultant2Token;
    private String officerToken;
    private String authorityToken;
    private String dualToken;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it3-" + suffix.toLowerCase(Locale.ROOT) + "-";

        stateId = create("/states", "{\"code\":\"ITP" + suffix + "\",\"name\":\"Proposal Test State\"}");
        district1 = create("/districts", "{\"code\":\"D1\",\"name\":\"District One\",\"stateId\":\"" + stateId + "\"}");
        district2 = create("/districts", "{\"code\":\"D2\",\"name\":\"District Two\",\"stateId\":\"" + stateId + "\"}");
        taluka1 = create("/talukas", "{\"code\":\"T1\",\"name\":\"Taluka One\",\"districtId\":\"" + district1 + "\"}");
        String taluka2 = create("/talukas", "{\"code\":\"T2\",\"name\":\"Taluka Two\",\"districtId\":\"" + district2 + "\"}");
        village1 = create("/villages", "{\"code\":\"V1\",\"name\":\"Village One\",\"talukaId\":\"" + taluka1 + "\"}");
        village2 = create("/villages", "{\"code\":\"V2\",\"name\":\"Village Two\",\"talukaId\":\"" + taluka2 + "\"}");
        String ministry = create("/ministries", "{\"code\":\"ITPM" + suffix + "\",\"name\":\"Test Ministry\"}");
        departmentId = create("/departments", "{\"code\":\"ITPD" + suffix + "\",\"name\":\"Test Roads Department\",\"ministryId\":\""
                + ministry + "\",\"level\":\"STATE\"}");

        UUID consultant = createUser("consultant", "CONSULTANT");
        UUID consultant2 = createUser("consultant2", "CONSULTANT");
        UUID officer = createUser("officer", "SCRUTINY_OFFICER");
        UUID authority = createUser("authority", "COMPETENT_AUTHORITY");
        UUID dual = createUser("dual", "SCRUTINY_OFFICER", "COMPETENT_AUTHORITY");
        assignScope(consultant, district1);
        assignScope(consultant2, district2);
        assignScope(officer, district1);
        assignScope(authority, district1);
        assignScope(dual, district1);

        consultantToken = login("consultant");
        consultant2Token = login("consultant2");
        officerToken = login("officer");
        authorityToken = login("authority");
        dualToken = login("dual");
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        jdbc.update("DELETE FROM notifications WHERE recipient_user_id IN " + owners, like);
        String projectsByOwner = "SELECT id FROM projects WHERE owner_user_id IN " + owners;
        String casesByProject = "SELECT id FROM acquisition_cases WHERE project_id IN (" + projectsByOwner + ")";
        jdbc.update("DELETE FROM case_villages WHERE case_id IN (" + casesByProject + ")", like);
        jdbc.update("DELETE FROM field_surveys WHERE case_id IN (" + casesByProject + ")", like);
        jdbc.update("DELETE FROM parcel_owners WHERE parcel_id IN (SELECT id FROM affected_parcels WHERE case_id IN (" + casesByProject + "))", like);
        jdbc.update("DELETE FROM affected_parcels WHERE case_id IN (" + casesByProject + ")", like);
        try {
            jdbc.execute("ALTER TABLE acquisition_case_history DISABLE TRIGGER trg_case_history_append_only");
            jdbc.update("DELETE FROM acquisition_case_history WHERE case_id IN (" + casesByProject + ")", like);
        } finally {
            jdbc.execute("ALTER TABLE acquisition_case_history ENABLE TRIGGER trg_case_history_append_only");
        }
        jdbc.update("DELETE FROM acquisition_cases WHERE project_id IN (" + projectsByOwner + ")", like);
        jdbc.update("DELETE FROM project_villages WHERE project_id IN (" + projectsByOwner + ")", like);
        jdbc.update("DELETE FROM projects WHERE owner_user_id IN " + owners, like);
        jdbc.update("DELETE FROM proposal_villages WHERE proposal_id IN (SELECT id FROM proposals WHERE owner_user_id IN " + owners + ")", like);
        try {
            jdbc.execute("ALTER TABLE proposal_status_history DISABLE TRIGGER trg_proposal_status_history_append_only");
            jdbc.execute("ALTER TABLE proposal_versions DISABLE TRIGGER trg_proposal_versions_append_only");
            jdbc.update("DELETE FROM proposal_status_history WHERE proposal_id IN (SELECT id FROM proposals WHERE owner_user_id IN " + owners + ")", like);
            jdbc.update("DELETE FROM proposal_versions WHERE proposal_id IN (SELECT id FROM proposals WHERE owner_user_id IN " + owners + ")", like);
        } finally {
            jdbc.execute("ALTER TABLE proposal_status_history ENABLE TRIGGER trg_proposal_status_history_append_only");
            jdbc.execute("ALTER TABLE proposal_versions ENABLE TRIGGER trg_proposal_versions_append_only");
        }
        jdbc.update("DELETE FROM proposals WHERE owner_user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        String stateCode = "ITP" + suffix;
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id "
                + "JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITPD" + suffix);
        jdbc.update("DELETE FROM ministries WHERE code = ?", "ITPM" + suffix);
    }

    // ------------------------------------------------------------------ helpers

    private RequestPostProcessor admin() {
        return jwt()
                .jwt(j -> j.subject(UUID.randomUUID().toString()).claim("username", "it-actor"))
                .authorities(
                        new SimpleGrantedAuthority("ROLE_CENTRAL_ADMIN"),
                        new SimpleGrantedAuthority("MASTER_DATA_READ"),
                        new SimpleGrantedAuthority("MASTER_DATA_WRITE"),
                        new SimpleGrantedAuthority("USER_READ"),
                        new SimpleGrantedAuthority("USER_WRITE"));
    }

    private String create(String path, String json) throws Exception {
        MvcResult result = mockMvc.perform(post(ADMIN + path).with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    private UUID createUser(String name, String... roleCodes) {
        UserAccount user = new UserAccount();
        user.setUsername(prefix + name);
        user.setEmail(prefix + name + "@test.invalid");
        user.setFullName("Integration " + name);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setEnabled(true);
        for (String code : roleCodes) {
            user.getRoles().add(roles.findByCode(code).orElseThrow());
        }
        return users.saveAndFlush(user).getId();
    }

    private void assignScope(UUID userId, String districtId) throws Exception {
        mockMvc.perform(put(ADMIN + "/users/" + userId + "/scopes").with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scopes\":[{\"districtId\":\"" + districtId + "\"}]}"))
                .andExpect(status().isOk());
    }

    private String login(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + prefix + name + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return "Bearer " + JsonPath.<String>read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private String proposalJson(String districtId, String villageId, String description) {
        return "{\"title\":\"State Highway Expansion\",\"projectType\":\"STATE_HIGHWAY\",\"districtId\":\"" + districtId
                + "\",\"talukaId\":\"" + taluka1 + "\",\"departmentId\":\"" + departmentId + "\",\"lengthKm\":60,"
                + "\"estimatedLandAreaHa\":150,\"villageIds\":[\"" + villageId + "\"],\"description\":\"" + description
                + "\",\"plannedStartDate\":\"2027-01-01\",\"plannedEndDate\":\"2028-12-31\"}";
    }

    private String createProposal(String token) throws Exception {
        MvcResult result = mockMvc.perform(post(PROPOSALS).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(proposalJson(district1, village1, "Expansion of existing state highway")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    private MvcResult act(String token, String id, String action, String json) throws Exception {
        var request = post(PROPOSALS + "/" + id + "/" + action).header("Authorization", token);
        if (json != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mockMvc.perform(request).andReturn();
    }

    private void expect(MvcResult result, int status) {
        assertThat(result.getResponse().getStatus())
                .as("HTTP status of %s", result.getRequest().getRequestURI())
                .isEqualTo(status);
    }

    // ------------------------------------------------------------------ tests

    @Test
    void fullWorkflow_fromDraftToApprovedProject() throws Exception {
        String id = createProposal(consultantToken);

        expect(act(consultantToken, id, "submit", null), 200);
        expect(act(officerToken, id, "start-scrutiny", null), 200);
        expect(act(officerToken, id, "clarification", "{\"reason\":\"Please add survey numbers\"}"), 200);

        mockMvc.perform(put(PROPOSALS + "/" + id).header("Authorization", consultantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(proposalJson(district1, village1, "Expansion with survey numbers added")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLARIFICATION_REQUESTED"));

        expect(act(consultantToken, id, "resubmit", null), 200);
        expect(act(officerToken, id, "start-scrutiny", null), 200);
        expect(act(officerToken, id, "recommend", "{\"reason\":\"Complete\"}"), 200);

        MvcResult approved = act(authorityToken, id, "approve", "{\"reason\":\"Approved\"}");
        expect(approved, 200);
        String projectCode = JsonPath.read(approved.getResponse().getContentAsString(), "$.projectCode");
        assertThat(projectCode).startsWith("PRJ-");

        mockMvc.perform(get(PROPOSALS + "/" + id).header("Authorization", consultantToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.versionNo").value(2))
                .andExpect(jsonPath("$.projectCode").value(projectCode));

        mockMvc.perform(get(PROPOSALS + "/" + id + "/history").header("Authorization", officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8));
        mockMvc.perform(get(PROPOSALS + "/" + id + "/versions").header("Authorization", officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(get("/api/v1/projects").header("Authorization", consultantToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].code").value(projectCode));
        mockMvc.perform(get("/api/v1/projects").header("Authorization", consultant2Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        // the consultant was told about scrutiny (twice), the clarification request and the approval
        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", consultantToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(4));
        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", authorityToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(1));
    }

    @Test
    void proposalNumbers_areUniqueAndSequential() throws Exception {
        String first = createProposal(consultantToken);
        String second = createProposal(consultantToken);
        MvcResult a = act(consultantToken, first, "submit", null);
        MvcResult b = act(consultantToken, second, "submit", null);
        expect(a, 200);
        expect(b, 200);

        String numberA = JsonPath.read(a.getResponse().getContentAsString(), "$.proposalNumber");
        String numberB = JsonPath.read(b.getResponse().getContentAsString(), "$.proposalNumber");
        assertThat(numberA).matches("PRP-\\d{4}-\\d{6}");
        assertThat(numberB).isNotEqualTo(numberA);
    }

    @Test
    void permissionsAndVisibility_areEnforcedByTheBackend() throws Exception {
        String id = createProposal(consultantToken);
        expect(act(consultantToken, id, "submit", null), 200);

        // another consultant cannot even see it
        mockMvc.perform(get(PROPOSALS + "/" + id).header("Authorization", consultant2Token))
                .andExpect(status().isNotFound());
        // a consultant cannot scrutinise or decide
        expect(act(consultantToken, id, "start-scrutiny", null), 403);
        expect(act(consultantToken, id, "approve", null), 403);
        // an officer cannot decide
        expect(act(officerToken, id, "start-scrutiny", null), 200);
        expect(act(officerToken, id, "approve", null), 403);
        // nobody can jump ahead: approving before a recommendation is a conflict
        expect(act(authorityToken, id, "approve", null), 409);
        // a consultant cannot create a proposal outside their district scope
        mockMvc.perform(post(PROPOSALS).header("Authorization", consultant2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(proposalJson(district1, village1, "Not my district")))
                .andExpect(status().isForbidden());
        // submitting twice is a conflict
        expect(act(consultantToken, id, "submit", null), 409);
        // a reason is mandatory for a clarification request
        expect(act(officerToken, id, "clarification", "{\"reason\":\"\"}"), 400);
    }

    @Test
    void separationOfDuties_theRecommenderCannotAlsoApprove() throws Exception {
        String id = createProposal(consultantToken);
        expect(act(consultantToken, id, "submit", null), 200);
        expect(act(dualToken, id, "start-scrutiny", null), 200);
        expect(act(dualToken, id, "recommend", null), 200);

        expect(act(dualToken, id, "approve", null), 403);
        expect(act(authorityToken, id, "approve", null), 200);
    }

    @Test
    void rejection_needsAReason_andTheOwnerCanReopenWithoutLosingTheNumber() throws Exception {
        String id = createProposal(consultantToken);
        expect(act(consultantToken, id, "submit", null), 200);
        expect(act(officerToken, id, "start-scrutiny", null), 200);

        expect(act(officerToken, id, "reject", "{\"reason\":\"\"}"), 400);
        expect(act(officerToken, id, "reject", "{\"reason\":\"Not viable\"}"), 200);
        expect(act(officerToken, id, "recommend", null), 409);
        mockMvc.perform(get(PROPOSALS + "/" + id).header("Authorization", consultantToken))
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.availableActions.length()").value(1))
                .andExpect(jsonPath("$.availableActions[0]").value("REOPEN"));

        // Another consultant cannot see the proposal at all; the owner must give a reason.
        expect(act(consultant2Token, id, "reopen", "{\"reason\":\"retry\"}"), 404);
        expect(act(consultantToken, id, "reopen", "{\"reason\":\"\"}"), 400);

        MvcResult reopened = act(consultantToken, id, "reopen", "{\"reason\":\"New survey numbers\"}");
        expect(reopened, 200);
        String number = JsonPath.read(reopened.getResponse().getContentAsString(), "$.proposalNumber");
        assertThat(number).startsWith("PRP-");

        mockMvc.perform(get(PROPOSALS + "/" + id).header("Authorization", consultantToken))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.proposalNumber").value(number))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.availableActions[0]").value("SUBMIT"));

        expect(act(consultantToken, id, "submit", null), 200);
        mockMvc.perform(get(PROPOSALS + "/" + id + "/history").header("Authorization", consultantToken))
                .andExpect(jsonPath("$[?(@.action == 'REOPEN')].reason").value("New survey numbers"));
        mockMvc.perform(get(PROPOSALS + "/" + id).header("Authorization", consultantToken))
                .andExpect(jsonPath("$.proposalNumber").value(number))
                .andExpect(jsonPath("$.versionNo").value(2));
    }

    @Test
    void validation_rejectsInconsistentProposals() throws Exception {
        // a village of another district
        mockMvc.perform(post(PROPOSALS).header("Authorization", consultantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(proposalJson(district1, village2, "Wrong village")))
                .andExpect(status().isBadRequest());
        // a road without a length
        mockMvc.perform(post(PROPOSALS).header("Authorization", consultantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(proposalJson(district1, village1, "No length").replace("\"lengthKm\":60,", "")))
                .andExpect(status().isBadRequest());
        // an unknown department
        mockMvc.perform(post(PROPOSALS).header("Authorization", consultantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(proposalJson(district1, village1, "No department").replace(departmentId, UUID.randomUUID().toString())))
                .andExpect(status().isBadRequest());
        // end date before start date
        mockMvc.perform(post(PROPOSALS).header("Authorization", consultantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(proposalJson(district1, village1, "Bad dates").replace("2028-12-31", "2026-12-31")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_showsConsultantsTheirOwn_andOfficersTheirScope() throws Exception {
        String id = createProposal(consultantToken);

        mockMvc.perform(get(PROPOSALS).header("Authorization", consultantToken))
                .andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get(PROPOSALS).header("Authorization", consultant2Token))
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(PROPOSALS).header("Authorization", officerToken).param("status", "DRAFT"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(id));
        mockMvc.perform(get(PROPOSALS).header("Authorization", officerToken).param("status", "SUBMITTED"))
                .andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get(PROPOSALS).header("Authorization", officerToken).param("status", "NOT_A_STATUS"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void notifications_canOnlyBeReadAndMarkedByTheirOwner() throws Exception {
        String id = createProposal(consultantToken);
        expect(act(consultantToken, id, "submit", null), 200);

        MvcResult mine = mockMvc.perform(get("/api/v1/notifications").header("Authorization", officerToken)
                        .param("unreadOnly", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andReturn();
        String notificationId = JsonPath.read(mine.getResponse().getContentAsString(), "$.content[0].id");

        mockMvc.perform(post("/api/v1/notifications/" + notificationId + "/read").header("Authorization", consultantToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/notifications/" + notificationId + "/read").header("Authorization", officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));
        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", officerToken))
                .andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void endpoints_requireLogin() throws Exception {
        mockMvc.perform(get(PROPOSALS)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(PROPOSALS + "/" + UUID.randomUUID() + "/submit")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/projects")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized());
        List<String> none = List.of();
        assertThat(none).isEmpty();
    }
}
