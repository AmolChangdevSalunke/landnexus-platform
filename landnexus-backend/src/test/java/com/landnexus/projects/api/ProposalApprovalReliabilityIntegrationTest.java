package com.landnexus.projects.api;

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
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.projects.application.AcquisitionCaseInitiator;
import com.landnexus.projects.application.ProposalService;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.projects.infrastructure.ProposalRepository;
import com.landnexus.shared.security.CurrentActor;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
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

/** Increment 2A: approval reliability, idempotency, transaction safety and concurrency. Runs only against isolated disposable PostgreSQL. */
@SpringBootTest(properties = "landnexus.test.fail-case-init=false")
@ActiveProfiles("integration")
class ProposalApprovalReliabilityIntegrationTest extends AbstractIsolatedPgIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String PROPOSALS = "/api/v1/projects/proposals";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ProposalService proposalService;
    @Autowired private ProposalRepository proposalRepository;
    @Autowired private ProjectRepository projects;
    @Autowired private AcquisitionCaseRepository cases;

    private MockMvc mockMvc;
    private String suffix, prefix;
    private String district1, village1, departmentId, taluka1;
    private UUID consultantId, officerId, authorityId;
    private String consultantToken, officerToken, authorityToken;
    private CurrentActor authorityActor;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it6-" + suffix.toLowerCase(Locale.ROOT) + "-";
        String stateCode = "ITR" + suffix;
        String stateId = create("/states", "{\"code\":\"" + stateCode + "\",\"name\":\"State " + suffix + "\"}");
        String ministryId = create("/ministries", "{\"code\":\"ITRM" + suffix + "\",\"name\":\"Ministry " + suffix + "\"}");
        departmentId = create("/departments", "{\"code\":\"ITRD" + suffix + "\",\"name\":\"Dept " + suffix
                + "\",\"ministryId\":\"" + ministryId + "\",\"level\":\"STATE\"}");
        district1 = create("/districts", "{\"stateId\":\"" + stateId + "\",\"code\":\"ITRD1" + suffix + "\",\"name\":\"District " + suffix + "\"}");
        taluka1 = create("/talukas", "{\"districtId\":\"" + district1 + "\",\"code\":\"ITRT1" + suffix + "\",\"name\":\"Taluka " + suffix + "\"}");
        village1 = create("/villages", "{\"talukaId\":\"" + taluka1 + "\",\"code\":\"ITRV1" + suffix + "\",\"name\":\"Village " + suffix + "\"}");

        consultantId = createUser("consultant", "CONSULTANT");
        officerId = createUser("officer", "SCRUTINY_OFFICER");
        authorityId = createUser("authority", "COMPETENT_AUTHORITY");
        assignScope(consultantId, district1);
        assignScope(officerId, district1);
        assignScope(authorityId, district1);

        consultantToken = login("consultant");
        officerToken = login("officer");
        authorityToken = login("authority");
        authorityActor = new CurrentActor(authorityId, prefix + "authority",
                Set.of("COMPETENT_AUTHORITY"), Set.of("PROPOSAL_READ", "PROPOSAL_DECIDE"));
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
        jdbc.update("DELETE FROM case_parcel_owners WHERE case_parcel_id IN (SELECT id FROM case_parcels WHERE case_id IN (" + casesByProject + "))", like);
        jdbc.update("DELETE FROM case_parcels WHERE case_id IN (" + casesByProject + ")", like);
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
        jdbc.update("DELETE FROM proposal_assignments WHERE proposal_id IN (SELECT id FROM proposals WHERE owner_user_id IN " + owners + ")", like);
        jdbc.update("DELETE FROM proposals WHERE owner_user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        String stateCode = "ITR" + suffix;
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id "
                + "JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITRD" + suffix);
        jdbc.update("DELETE FROM ministries WHERE code = ?", "ITRM" + suffix);
    }

    @Test
    void successfulApproval_createsExactlyOneProjectAndOneCase() throws Exception {
        String id = recommendProposal();
        MvcResult approved = act(authorityToken, id, "approve", "{\"reason\":\"Approved\"}");
        assertThat(approved.getResponse().getStatus()).isEqualTo(200);
        String body = approved.getResponse().getContentAsString();
        assertThat(JsonPath.<String>read(body, "$.projectCode")).startsWith("PRJ-");
        assertThat(JsonPath.<String>read(body, "$.acquisitionCaseNumber")).startsWith("ACQ-");

        UUID proposalId = UUID.fromString(id);
        assertThat(projects.findByProposalId(proposalId)).isPresent();
        UUID projectId = projects.findByProposalId(proposalId).orElseThrow().getId();
        assertThat(cases.findAllByProjectId(projectId)).hasSize(1);
        assertThat(count("projects where proposal_id = '" + id + "'")).isEqualTo(1);
        assertThat(count("acquisition_cases where project_id = '" + projectId + "'")).isEqualTo(1);
    }

    @Test
    void repeatedApproval_isIdempotentAndReusesExistingArtifacts() throws Exception {
        String id = recommendProposal();
        MvcResult first = act(authorityToken, id, "approve", "{\"reason\":\"Approved\"}");
        assertThat(first.getResponse().getStatus()).isEqualTo(200);
        String firstCode = JsonPath.read(first.getResponse().getContentAsString(), "$.projectCode");
        String firstCase = JsonPath.read(first.getResponse().getContentAsString(), "$.acquisitionCaseNumber");

        MvcResult second = act(authorityToken, id, "approve", "{\"reason\":\"Approved again\"}");
        assertThat(second.getResponse().getStatus()).isEqualTo(200);
        assertThat(JsonPath.<String>read(second.getResponse().getContentAsString(), "$.projectCode")).isEqualTo(firstCode);
        assertThat(JsonPath.<String>read(second.getResponse().getContentAsString(), "$.acquisitionCaseNumber")).isEqualTo(firstCase);

        UUID projectId = projects.findByProposalId(UUID.fromString(id)).orElseThrow().getId();
        assertThat(count("projects where proposal_id = '" + id + "'")).isEqualTo(1);
        assertThat(count("acquisition_cases where project_id = '" + projectId + "'")).isEqualTo(1);
    }

    @Test
    void concurrentApprovals_createNoDuplicateProjectOrCase() throws Exception {
        String id = recommendProposal();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> task = () -> {
            ready.countDown();
            start.await(5, TimeUnit.SECONDS);
            try {
                proposalService.transition(UUID.fromString(id), "APPROVE", "Approved", authorityActor);
                return 200;
            } catch (Exception ex) {
                return 409; // conflict/retry semantics acceptable under race if no duplicates
            }
        };
        Future<Integer> f1 = pool.submit(task);
        Future<Integer> f2 = pool.submit(task);
        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        Integer s1 = f1.get(30, TimeUnit.SECONDS);
        Integer s2 = f2.get(30, TimeUnit.SECONDS);
        pool.shutdownNow();

        assertThat(List.of(s1, s2)).anyMatch(s -> s == 200);
        assertThat(proposalRepository.findById(UUID.fromString(id)).orElseThrow().getStatus())
                .isEqualTo(ProposalStatus.APPROVED);
        assertThat(count("projects where proposal_id = '" + id + "'")).isEqualTo(1);
        Project project = projects.findByProposalId(UUID.fromString(id)).orElseThrow();
        assertThat(count("acquisition_cases where project_id = '" + project.getId() + "'")).isEqualTo(1);
        assertThat(cases.findAllByProjectId(project.getId())).hasSize(1);
    }

    @Test
    void invalidStateAndUnauthorizedApproval_remainRejected() throws Exception {
        String id = createProposal(consultantToken);
        assertThat(act(consultantToken, id, "approve", null).getResponse().getStatus()).isEqualTo(403);
        assertThat(act(authorityToken, id, "approve", null).getResponse().getStatus()).isEqualTo(409); // not recommended yet
    }

    @Test
    void successfulApproval_recordsProposalAndCaseHistoryAndAudit() throws Exception {
        String id = recommendProposal();
        assertThat(act(authorityToken, id, "approve", "{\"reason\":\"Approved\"}").getResponse().getStatus()).isEqualTo(200);
        int proposalHistory = jdbc.queryForObject(
                "SELECT COUNT(*) FROM proposal_status_history WHERE proposal_id = ?::uuid AND action = 'APPROVE'",
                Integer.class, id);
        assertThat(proposalHistory).isEqualTo(1);
        UUID projectId = projects.findByProposalId(UUID.fromString(id)).orElseThrow().getId();
        int caseHistory = jdbc.queryForObject(
                "SELECT COUNT(*) FROM acquisition_case_history WHERE case_id = (SELECT id FROM acquisition_cases WHERE project_id = ?)",
                Integer.class, projectId);
        assertThat(caseHistory).isGreaterThanOrEqualTo(1);
        Integer proposalAudit = jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_events WHERE entity_type = 'Proposal' AND entity_id = ?::uuid AND action = 'APPROVE'",
                Integer.class, id);
        assertThat(proposalAudit).isNotNull();
        assertThat(proposalAudit).isGreaterThanOrEqualTo(1);
    }

    @Test
    void successfulApproval_sendsNotificationToOwner() throws Exception {
        String id = recommendProposal();
        act(authorityToken, id, "approve", "{\"reason\":\"Approved\"}");
        Integer unread = jdbc.queryForObject(
                "SELECT COUNT(*) FROM notifications WHERE recipient_user_id = ? AND entity_id = ?::uuid AND title = 'Proposal approved'",
                Integer.class, consultantId, id);
        assertThat(unread).isNotNull();
        assertThat(unread).isGreaterThanOrEqualTo(1);
    }

    // --- helpers ---

    private String recommendProposal() throws Exception {
        String id = createProposal(consultantToken);
        assertThat(act(consultantToken, id, "submit", null).getResponse().getStatus()).isEqualTo(200);
        assertThat(act(officerToken, id, "start-scrutiny", null).getResponse().getStatus()).isEqualTo(200);
        assertThat(act(officerToken, id, "recommend", "{\"reason\":\"Complete\"}").getResponse().getStatus()).isEqualTo(200);
        return id;
    }

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

    private int count(String tableAndWhere) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + tableAndWhere, Integer.class);
        return n == null ? 0 : n;
    }
}
