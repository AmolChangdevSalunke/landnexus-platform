package com.landnexus.projects.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.projects.application.AcquisitionCaseInitiator;
import com.landnexus.projects.application.ProposalService;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.projects.infrastructure.ProposalRepository;
import com.landnexus.shared.security.CurrentActor;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;

/** Verifies approval rolls back if acquisition case initiation fails. Runs only against isolated disposable PostgreSQL. */
@SpringBootTest
@ActiveProfiles("integration")
class ProposalApprovalRollbackIntegrationTest extends AbstractIsolatedPgIntegrationTest {

    @TestConfiguration
    static class FailingInitiatorConfig {
        @Bean
        @Primary
        AcquisitionCaseInitiator failingInitiator() {
            return new AcquisitionCaseInitiator() {
                @Override
                public Optional<InitiatedCase> initiateForApprovedProject(Project project, Proposal proposal, CurrentActor actor) {
                    throw new RuntimeException("Simulated acquisition case initiation failure");
                }

                @Override
                public Optional<String> findCaseNumberByProjectId(UUID projectId) {
                    return Optional.empty();
                }
            };
        }
    }

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

    private MockMvc mockMvc;
    private String suffix, prefix, district1, village1, departmentId, taluka1;
    private UUID authorityId;
    private String consultantToken, officerToken;
    private CurrentActor authorityActor;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it7-" + suffix.toLowerCase(Locale.ROOT) + "-";
        String stateCode = "ITB" + suffix;
        String stateId = create("/states", "{\"code\":\"" + stateCode + "\",\"name\":\"State " + suffix + "\"}");
        departmentId = create("/departments", "{\"code\":\"ITBD" + suffix + "\",\"name\":\"Dept " + suffix + "\"}");
        district1 = create("/districts", "{\"stateId\":\"" + stateId + "\",\"code\":\"ITBD1" + suffix + "\",\"name\":\"District " + suffix + "\"}");
        taluka1 = create("/talukas", "{\"districtId\":\"" + district1 + "\",\"code\":\"ITBT1" + suffix + "\",\"name\":\"Taluka " + suffix + "\"}");
        village1 = create("/villages", "{\"talukaId\":\"" + taluka1 + "\",\"code\":\"ITBV1" + suffix + "\",\"name\":\"Village " + suffix + "\"}");

        UUID consultantId = createUser("consultant", "CONSULTANT");
        UUID officerId = createUser("officer", "SCRUTINY_OFFICER");
        authorityId = createUser("authority", "COMPETENT_AUTHORITY");
        assignScope(consultantId, district1);
        assignScope(officerId, district1);
        assignScope(authorityId, district1);
        consultantToken = login("consultant");
        officerToken = login("officer");
        authorityActor = new CurrentActor(authorityId, prefix + "authority", Set.of("PROPOSAL_DECIDE"));
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        jdbc.update("DELETE FROM notifications WHERE recipient_user_id IN " + owners, like);
        String projectsByOwner = "SELECT id FROM projects WHERE owner_user_id IN " + owners;
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
        String stateCode = "ITB" + suffix;
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITBD" + suffix);
    }

    @Test
    void caseInitiationFailure_rollsBackApprovalAndProjectCreation() throws Exception {
        String id = createProposal(consultantToken);
        act(consultantToken, id, "submit", null);
        act(officerToken, id, "start-scrutiny", null);
        act(officerToken, id, "recommend", "{\"reason\":\"Complete\"}");

        assertThatThrownBy(() -> proposalService.transition(UUID.fromString(id), "APPROVE", "Approved", authorityActor))
                .hasMessageContaining("Simulated acquisition case initiation failure");

        Proposal proposal = proposalRepository.findById(UUID.fromString(id)).orElseThrow();
        assertThat(proposal.getStatus()).isNotEqualTo(ProposalStatus.APPROVED);
        assertThat(projects.findByProposalId(proposal.getId())).isEmpty();
    }

    // helpers
    private RequestPostProcessor admin() {
        return SecurityMockMvcRequestPostProcessors.jwt()
                .jwt(j -> j.subject(UUID.randomUUID().toString()).claim("username", "it-actor"))
                .authorities(new SimpleGrantedAuthority("ROLE_CENTRAL_ADMIN"),
                        new SimpleGrantedAuthority("MASTER_DATA_READ"), new SimpleGrantedAuthority("MASTER_DATA_WRITE"),
                        new SimpleGrantedAuthority("USER_READ"), new SimpleGrantedAuthority("USER_WRITE"));
    }

    private String create(String path, String json) throws Exception {
        MvcResult result = mockMvc.perform(post(ADMIN + path).with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    private UUID createUser(String name, String... roleCodes) {
        UserAccount user = new UserAccount();
        user.setUsername(prefix + name);
        user.setEmail(prefix + name + "@test.invalid");
        user.setFullName("Integration " + name);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setEnabled(true);
        for (String code : roleCodes) user.getRoles().add(roles.findByCode(code).orElseThrow());
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
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + JsonPath.<String>read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private String createProposal(String token) throws Exception {
        String json = "{\"title\":\"State Highway Expansion\",\"projectType\":\"STATE_HIGHWAY\",\"districtId\":\"" + district1
                + "\",\"talukaId\":\"" + taluka1 + "\",\"departmentId\":\"" + departmentId + "\",\"lengthKm\":60,"
                + "\"estimatedLandAreaHa\":150,\"villageIds\":[\"" + village1 + "\"],\"description\":\"Expansion\","
                + "\"plannedStartDate\":\"2027-01-01\",\"plannedEndDate\":\"2028-12-31\"}";
        MvcResult result = mockMvc.perform(post(PROPOSALS).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    private void act(String token, String id, String action, String json) throws Exception {
        var request = post(PROPOSALS + "/" + id + "/" + action).header("Authorization", token);
        if (json != null) request = request.contentType(MediaType.APPLICATION_JSON).content(json);
        mockMvc.perform(request).andExpect(status().isOk());
    }
}
