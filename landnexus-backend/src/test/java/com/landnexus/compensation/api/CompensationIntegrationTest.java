package com.landnexus.compensation.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

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
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** Real database, real filter chain, real tokens, synthetic DEMO data only. */
@SpringBootTest
@ActiveProfiles("integration")
class CompensationIntegrationTest extends AbstractIsolatedPgIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String LR = "/api/v1/land-records";
    private static final String C = "/api/v1/compensation";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix, prefix, stateCode, ruleSetName;
    private String state, district1, village1, village2, parcelId;
    private UUID projectId, caseId, caseParcelId, authorityId;
    private String ruleMaker, ruleApprover, manager, authority, finance, field1, field2, consultant;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it6-" + suffix.toLowerCase(Locale.ROOT) + "-";
        stateCode = "ITC" + suffix;
        ruleSetName = "IT6-" + suffix;

        state = admin("/states", "{\"code\":\"" + stateCode + "\",\"name\":\"Compensation Test State\"}");
        district1 = admin("/districts", "{\"code\":\"D1\",\"name\":\"District One\",\"stateId\":\"" + state + "\"}");
        String district2 = admin("/districts", "{\"code\":\"D2\",\"name\":\"District Two\",\"stateId\":\"" + state + "\"}");
        String taluka1 = admin("/talukas", "{\"code\":\"T1\",\"name\":\"Taluka One\",\"districtId\":\"" + district1 + "\"}");
        admin("/talukas", "{\"code\":\"T2\",\"name\":\"Taluka Two\",\"districtId\":\"" + district2 + "\"}");
        village1 = admin("/villages", "{\"code\":\"V1\",\"name\":\"Village One\",\"talukaId\":\"" + taluka1 + "\"}");
        String ministry = admin("/ministries", "{\"code\":\"ITCM" + suffix + "\",\"name\":\"Test Ministry\"}");
        String department = admin("/departments", "{\"code\":\"ITCD" + suffix + "\",\"name\":\"Test Department\",\"ministryId\":\""
                + ministry + "\",\"level\":\"STATE\"}");

        user("rulemaker", "CENTRAL_ADMIN");
        user("ruleapprover", "SUPER_ADMIN");
        UUID mgr = user("manager", "SCRUTINY_OFFICER");
        authorityId = user("authority", "COMPETENT_AUTHORITY");
        UUID fin = user("finance", "FINANCE_OFFICER");
        UUID f1 = user("field1", "FIELD_OFFICER");
        UUID f2 = user("field2", "FIELD_OFFICER");
        UUID con = user("consultant", "CONSULTANT");
        for (UUID u : new UUID[] {mgr, authorityId, fin, f1}) {
            scope(u, district1);
        }
        scope(f2, district2);
        ruleMaker = login("rulemaker");
        ruleApprover = login("ruleapprover");
        manager = login("manager");
        authority = login("authority");
        finance = login("finance");
        field1 = login("field1");
        field2 = login("field2");
        consultant = login("consultant");

        UUID proposalId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        jdbc.update("INSERT INTO proposals (id, proposal_number, title, project_type, status, version_no, state_id, district_id, "
                        + "department_id, estimated_land_area_ha, description, planned_start_date, planned_end_date, owner_user_id, submitted_at) "
                        + "VALUES (?, ?, 'DEMO IT proposal', 'STATE_HIGHWAY', 'APPROVED', 1, ?, ?, ?, 10, 'DEMO', DATE '2027-01-01', DATE '2028-01-01', ?, now())",
                proposalId, "PRP-IT6-" + suffix, UUID.fromString(state), UUID.fromString(district1), UUID.fromString(department), con);
        jdbc.update("INSERT INTO projects (id, code, proposal_id, title, project_type, status, state_id, district_id, department_id, "
                        + "estimated_land_area_ha, owner_user_id, approved_by_user_id, approved_at) "
                        + "VALUES (?, ?, ?, 'DEMO IT project', 'STATE_HIGHWAY', 'ACTIVE', ?, ?, ?, 10, ?, ?, now())",
                projectId, "PRJ-IT6-" + suffix, proposalId, UUID.fromString(state), UUID.fromString(district1),
                UUID.fromString(department), con, authorityId);
        jdbc.update("INSERT INTO project_villages (project_id, village_id) VALUES (?, ?)", projectId, UUID.fromString(village1));

        // a parcel through the real API, then a case that already has its award (Module 4 is tested on its own)
        parcelId = id(call(field1, "POST", LR + "/parcels", "{\"villageId\":\"" + village1 + "\",\"gatNumber\":\"DEMO-701\",\"areaHa\":2.0,"
                + "\"classification\":\"AGRICULTURAL_DRY\",\"landUse\":\"CULTIVATION\"}"));
        caseId = UUID.randomUUID();
        caseParcelId = UUID.randomUUID();
        UUID awardId = UUID.randomUUID();
        jdbc.update("INSERT INTO acquisition_cases (id, case_number, project_id, state_id, district_id, framework, status) "
                        + "VALUES (?, ?, ?, ?, ?, 'LARR_2013', 'AWARD_DECLARED')", caseId, "ACQ-IT6-" + suffix, projectId,
                UUID.fromString(state), UUID.fromString(district1));
        jdbc.update("INSERT INTO case_parcels (id, case_id, parcel_id, village_id, area_to_acquire_ha) VALUES (?, ?, ?, ?, 1.5)",
                caseParcelId, caseId, UUID.fromString(parcelId), UUID.fromString(village1));
        jdbc.update("INSERT INTO legal_notices (case_id, notice_type, reference_number, issued_on, objection_deadline) "
                + "VALUES (?, 'PRELIMINARY_NOTIFICATION', ?, CURRENT_DATE - 60, CURRENT_DATE - 30)", caseId, "DEMO-GZ-" + suffix);
        jdbc.update("INSERT INTO acquisition_awards (id, case_id, award_number, award_date, declared_by_user_id) "
                + "VALUES (?, ?, ?, CURRENT_DATE - 10, ?)", awardId, caseId, "DEMO-AW-" + suffix, authorityId);
        jdbc.update("INSERT INTO award_parcels (award_id, case_parcel_id, awarded_area_ha) VALUES (?, ?, 1.5)", awardId, caseParcelId);
    }

    @AfterEach
    void cleanUp() {
        try {
            jdbc.execute("ALTER TABLE payment_events DISABLE TRIGGER trg_payment_events_append_only");
            jdbc.update("DELETE FROM payment_events WHERE payment_id IN (SELECT id FROM compensation_payments WHERE case_id = ?)", caseId);
        } finally {
            jdbc.execute("ALTER TABLE payment_events ENABLE TRIGGER trg_payment_events_append_only");
        }
        jdbc.update("DELETE FROM compensation_payments WHERE case_id = ?", caseId);
        jdbc.update("DELETE FROM rr_entitlements WHERE rr_case_id IN (SELECT id FROM rr_cases WHERE case_id = ?)", caseId);
        jdbc.update("DELETE FROM rr_cases WHERE case_id = ?", caseId);
        jdbc.update("DELETE FROM rr_benefit_types WHERE code LIKE ?", "%" + suffix);
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        jdbc.update("DELETE FROM valuation_lines WHERE valuation_id IN (SELECT id FROM valuations WHERE case_id = ?)", caseId);
        jdbc.update("DELETE FROM valuations WHERE case_id = ?", caseId);
        jdbc.update("DELETE FROM asset_records WHERE case_parcel_id = ?", caseParcelId);
        jdbc.update("DELETE FROM case_parcel_owners WHERE case_parcel_id = ?", caseParcelId);
        jdbc.update("DELETE FROM award_parcels WHERE award_id IN (SELECT id FROM acquisition_awards WHERE case_id = ?)", caseId);
        jdbc.update("DELETE FROM acquisition_awards WHERE case_id = ?", caseId);
        jdbc.update("DELETE FROM legal_notices WHERE case_id = ?", caseId);
        jdbc.update("DELETE FROM case_parcels WHERE case_id = ?", caseId);
        jdbc.update("DELETE FROM acquisition_cases WHERE id = ?", caseId);
        try {
            jdbc.execute("ALTER TABLE rule_set_components DISABLE TRIGGER trg_rule_set_components_append_only");
            jdbc.update("DELETE FROM rule_set_components WHERE rule_set_id IN (SELECT id FROM valuation_rule_sets WHERE name = ?)", ruleSetName);
        } finally {
            jdbc.execute("ALTER TABLE rule_set_components ENABLE TRIGGER trg_rule_set_components_append_only");
        }
        jdbc.update("DELETE FROM valuation_rule_sets WHERE name = ?", ruleSetName);
        jdbc.update("DELETE FROM market_value_rates WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM notifications WHERE recipient_user_id IN " + owners, like);
        jdbc.update("DELETE FROM project_villages WHERE project_id = ?", projectId);
        jdbc.update("DELETE FROM projects WHERE id = ?", projectId);
        jdbc.update("DELETE FROM proposals WHERE proposal_number = ?", "PRP-IT6-" + suffix);
        String parcels = "(SELECT p.id FROM land_parcels p JOIN districts d ON d.id = p.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)";
        jdbc.update("DELETE FROM parcel_ownerships WHERE parcel_id IN " + parcels, stateCode);
        jdbc.update("DELETE FROM land_parcels WHERE id IN " + parcels, stateCode);
        jdbc.update("DELETE FROM landowners WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITCD" + suffix);
        jdbc.update("DELETE FROM ministries WHERE code = ?", "ITCM" + suffix);
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
        var request = "POST".equals(method) ? post(path) : "PUT".equals(method) ? put(path) : get(path);
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

    private String rateJson() {
        return "{\"villageId\":\"" + village1 + "\",\"classification\":\"AGRICULTURAL_DRY\",\"ratePerHa\":1000000,"
                + "\"effectiveFrom\":\"2020-01-01\",\"sourceNote\":\"DEMO illustrative rate\"}";
    }

    private String ruleSetJson(String multiplier) {
        return "{\"name\":\"" + ruleSetName + "\",\"framework\":\"LARR_2013\",\"districtId\":\"" + district1
                + "\",\"effectiveFrom\":\"2020-01-01\",\"description\":\"DEMO illustrative rule set, not a real law\",\"components\":["
                + "{\"code\":\"LAND\",\"name\":\"Land value\",\"type\":\"LAND_VALUE\",\"factor\":" + multiplier + "},"
                + "{\"code\":\"ASSETS\",\"name\":\"Assets\",\"type\":\"ASSET_VALUE\"},"
                + "{\"code\":\"SOLATIUM\",\"name\":\"Solatium\",\"type\":\"PERCENT_OF\",\"factor\":100,\"baseCodes\":[\"LAND\",\"ASSETS\"]}]}";
    }

    private static final String ASSET = "{\"category\":\"BUILDING\",\"description\":\"DEMO shed\",\"quantity\":2,\"unit\":\"nos\",\"unitValue\":50000.50}";

    private String valuationPath() {
        return C + "/cases/" + caseId + "/parcels/" + caseParcelId + "/valuations";
    }

    /** rate + rule set approved by a second person, one asset, estimate computed, submitted and approved. */
    private String approvedValuation() throws Exception {
        String rate = id(call(ruleMaker, "POST", C + "/rates", rateJson()));
        expect(call(ruleApprover, "POST", C + "/rates/" + rate + "/approve", null), 200);
        String rs = id(call(ruleMaker, "POST", C + "/rule-sets", ruleSetJson("1.5")));
        expect(call(ruleApprover, "POST", C + "/rule-sets/" + rs + "/approve", null), 200);
        expect(call(manager, "POST", C + "/cases/" + caseId + "/parcels/" + caseParcelId + "/assets", ASSET), 201);
        String valuation = id(call(manager, "POST", valuationPath(), null));
        expect(call(manager, "POST", C + "/valuations/" + valuation + "/submit", null), 200);
        expect(call(authority, "POST", C + "/valuations/" + valuation + "/approve", null), 200);
        return valuation;
    }

    /** Two DEMO landowners owning the parcel 60% and 40% in the case's ownership snapshot. */
    private String[] snapshotOwners() throws Exception {
        String a = id(call(field1, "POST", LR + "/landowners", "{\"districtId\":\"" + district1 + "\",\"ownerType\":\"INDIVIDUAL\",\"fullName\":\"DEMO Owner One\"}"));
        String b = id(call(field1, "POST", LR + "/landowners", "{\"districtId\":\"" + district1 + "\",\"ownerType\":\"INDIVIDUAL\",\"fullName\":\"DEMO Owner Two\"}"));
        jdbc.update("INSERT INTO case_parcel_owners (case_parcel_id, landowner_id, share_percent) VALUES (?, ?, 60)", caseParcelId, UUID.fromString(a));
        jdbc.update("INSERT INTO case_parcel_owners (case_parcel_id, landowner_id, share_percent) VALUES (?, ?, 40)", caseParcelId, UUID.fromString(b));
        return new String[] {a, b};
    }

    // ------------------------------------------------------------------ tests

    @Test
    void ratesAndRuleSets_needASecondPerson_andFollowTheirRules() throws Exception {
        expect(call(manager, "POST", C + "/rates", rateJson()), 403);
        String rate = id(call(ruleMaker, "POST", C + "/rates", rateJson()));
        expect(call(ruleMaker, "POST", C + "/rates", rateJson()), 409);
        expect(call(ruleMaker, "POST", C + "/rates/" + rate + "/approve", null), 403);
        expect(call(ruleApprover, "POST", C + "/rates/" + rate + "/reject", "{\"remarks\":\"\"}"), 400);
        expect(call(ruleApprover, "POST", C + "/rates/" + rate + "/approve", null), 200);
        expect(call(ruleApprover, "POST", C + "/rates/" + rate + "/approve", null), 409);

        expect(call(manager, "POST", C + "/rule-sets", ruleSetJson("1.5")), 403);
        expect(call(ruleMaker, "POST", C + "/rule-sets", ruleSetJson("11")), 400);
        expect(call(ruleMaker, "POST", C + "/rule-sets", "{\"name\":\"" + ruleSetName + "\",\"framework\":\"LARR_2013\","
                + "\"effectiveFrom\":\"2020-01-01\",\"components\":[{\"code\":\"ASSETS\",\"name\":\"A\",\"type\":\"ASSET_VALUE\"}]}"), 400);
        String rs = id(call(ruleMaker, "POST", C + "/rule-sets", ruleSetJson("1.5")));
        expect(call(ruleMaker, "POST", C + "/rule-sets/" + rs + "/approve", null), 403);
        expect(call(ruleApprover, "POST", C + "/rule-sets/" + rs + "/approve", null), 200);
        expect(call(ruleApprover, "POST", C + "/rule-sets/" + rs + "/approve", null), 409);
        expect(call(finance, "GET", C + "/rule-sets/" + rs, null), 200);
        expect(call(consultant, "GET", C + "/rule-sets/" + rs, null), 403);
    }

    @Test
    void estimate_isComputedReproducibly_andApprovedByAnotherPerson() throws Exception {
        // a rule set alone is not enough: the market value rate must also be approved
        String rs = id(call(ruleMaker, "POST", C + "/rule-sets", ruleSetJson("1.5")));
        expect(call(ruleApprover, "POST", C + "/rule-sets/" + rs + "/approve", null), 200);
        String rate = id(call(ruleMaker, "POST", C + "/rates", rateJson()));
        expect(call(manager, "POST", valuationPath(), null), 400);
        expect(call(ruleApprover, "POST", C + "/rates/" + rate + "/approve", null), 200);

        String assets = C + "/cases/" + caseId + "/parcels/" + caseParcelId + "/assets";
        expect(call(field1, "POST", assets, ASSET), 403);
        expect(call(field2, "POST", assets, ASSET), 403);
        expect(call(manager, "POST", assets, ASSET), 201);
        expect(call(finance, "GET", assets, null), 200);

        expect(call(finance, "POST", valuationPath(), null), 403);
        MvcResult first = call(manager, "POST", valuationPath(), null);
        expect(first, 201);
        String body = first.getResponse().getContentAsString();
        assertThat(body).contains("\"totalAmount\":4700002.0").contains("\"versionNo\":1").contains("\"status\":\"DRAFT\"")
                .contains(ruleSetName);
        mockMvc.perform(get(C + "/valuations/" + id(first)).header("Authorization", finance))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lines.length()").value(3));

        MvcResult second = call(manager, "POST", valuationPath(), null);
        expect(second, 201);
        assertThat(second.getResponse().getContentAsString()).contains("\"versionNo\":2").contains("\"totalAmount\":4700002.0");
        String valuation = id(second);

        expect(call(field1, "GET", C + "/cases/" + caseId + "/valuations", null), 403);
        expect(call(field2, "GET", C + "/cases/" + caseId + "/valuations", null), 403);
        expect(call(finance, "POST", C + "/valuations/" + valuation + "/submit", null), 403);
        expect(call(manager, "POST", C + "/valuations/" + valuation + "/submit", null), 200);

        // a submitted estimate is frozen
        expect(call(manager, "POST", valuationPath(), null), 409);
        expect(call(manager, "POST", assets, ASSET), 409);
        expect(call(manager, "POST", C + "/valuations/" + valuation + "/approve", null), 403);
        expect(call(authority, "POST", C + "/valuations/" + valuation + "/reject", "{\"remarks\":\"\"}"), 400);
        expect(call(authority, "POST", C + "/valuations/" + valuation + "/approve", "{\"remarks\":\"DEMO: checked\"}"), 200);
        expect(call(authority, "POST", C + "/valuations/" + valuation + "/approve", null), 409);

        MvcResult summary = call(finance, "GET", C + "/cases/" + caseId + "/compensation-summary", null);
        expect(summary, 200);
        assertThat(summary.getResponse().getContentAsString()).contains("\"approved\":1").contains("\"approvedTotal\":4700002.0");
        expect(call(consultant, "GET", C + "/cases/" + caseId + "/compensation-summary", null), 403);
    }

    @Test
    void aCaseOutsideTheCallersDistrict_isNotFound() throws Exception {
        approvedValuation();
        // field2 has no valuation permission at all, so the scope rule is shown with a user who has both
        UUID other = user("otherdistrict", "SCRUTINY_OFFICER");
        scope(other, jdbc.queryForObject("SELECT d.id::text FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ? AND d.code = 'D2'",
                String.class, stateCode));
        String otherToken = login("otherdistrict");

        expect(call(otherToken, "GET", C + "/cases/" + caseId + "/valuations", null), 404);
        expect(call(otherToken, "GET", C + "/cases/" + caseId + "/compensation-summary", null), 404);
        expect(call(otherToken, "POST", valuationPath(), null), 404);
    }

    @Test
    void payments_areSplitExactly_released_failed_retried_andAlwaysSimulated() throws Exception {
        snapshotOwners();
        String valuation = approvedValuation();
        String generate = C + "/valuations/" + valuation + "/payments";

        expect(call(manager, "POST", generate, null), 403);
        expect(call(field1, "POST", generate, null), 403);
        MvcResult created = call(finance, "POST", generate, "{\"paymentChannel\":\"PFMS_SIMULATED\"}");
        expect(created, 201);
        String body = created.getResponse().getContentAsString();
        assertThat(body).contains("\"amount\":2820001.2").contains("\"amount\":1880000.8").contains("\"mode\":\"SIMULATED\"")
                .contains("\"status\":\"INSTRUCTED\"").contains("\"paymentChannel\":\"PFMS_SIMULATED\"")
                .doesNotContain("DEMO Owner");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM compensation_payments WHERE valuation_id = ? AND payment_channel = 'PFMS_SIMULATED'",
                Integer.class, UUID.fromString(valuation))).isEqualTo(2);
        MvcResult dashboard = call(finance, "GET", "/api/v1/monitoring/dashboard?districtId=" + district1, null);
        expect(dashboard, 200);
        Long railCount = jdbc.queryForObject("SELECT COUNT(*) FROM compensation_payments WHERE valuation_id = ? "
                + "AND payment_channel = 'PFMS_SIMULATED'", Long.class, UUID.fromString(valuation));
        java.math.BigDecimal railAmount = jdbc.queryForObject("SELECT SUM(amount) FROM compensation_payments WHERE valuation_id = ? "
                + "AND payment_channel = 'PFMS_SIMULATED'", java.math.BigDecimal.class, UUID.fromString(valuation));
        assertThat(JsonPath.<Integer>read(dashboard.getResponse().getContentAsString(),
                "$.finance.paymentsByChannel.PFMS_SIMULATED[0].count")).isEqualTo(railCount.intValue());
        assertThat(JsonPath.<Double>read(dashboard.getResponse().getContentAsString(),
                "$.finance.paymentsByChannel.PFMS_SIMULATED[0].amount")).isEqualTo(railAmount.doubleValue());
        expect(call(finance, "POST", generate, null), 409);
        String first = JsonPath.read(body, "$[0].id");
        String second = JsonPath.read(body, "$[1].id");

        String p1 = C + "/payments/" + first;
        expect(call(manager, "POST", p1 + "/release", null), 403);
        expect(call(authority, "POST", p1 + "/release", null), 403);
        MvcResult sent = call(finance, "POST", p1 + "/release", null);
        expect(sent, 200);
        assertThat(sent.getResponse().getContentAsString()).contains("\"status\":\"SENT\"").contains("SIM-PFMS-").contains("\"attemptCount\":1");
        expect(call(finance, "POST", p1 + "/release", null), 409);

        expect(call(finance, "POST", p1 + "/simulate-response", "{\"outcome\":\"FAILED\"}"), 400);
        expect(call(finance, "POST", p1 + "/simulate-response", "{\"outcome\":\"INSTRUCTED\"}"), 400);
        expect(call(finance, "POST", p1 + "/simulate-response", "{\"outcome\":\"FAILED\",\"reason\":\"DEMO: simulated rejection\"}"), 200);
        MvcResult retry = call(finance, "POST", p1 + "/release", null);
        expect(retry, 200);
        assertThat(retry.getResponse().getContentAsString()).contains("\"attemptCount\":2");
        expect(call(finance, "POST", p1 + "/simulate-response", "{\"outcome\":\"CONFIRMED\"}"), 200);
        expect(call(finance, "POST", p1 + "/simulate-response", "{\"outcome\":\"CONFIRMED\"}"), 409);
        MvcResult receipt = call(finance, "GET", p1 + "/receipt", null);
        expect(receipt, 200);
        assertThat(receipt.getResponse().getContentType()).contains("text/plain");
        assertThat(receipt.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(receipt.getResponse().getHeader("Content-Disposition")).contains("attachment");
        assertThat(receipt.getResponse().getContentAsString())
                .contains("DEMO / SIMULATED PAYMENT RECORD")
                .contains("No money was transferred")
                .contains("SIM-PFMS-")
                .contains("Status: CONFIRMED")
                .doesNotContain("DEMO Owner", "account number", "IFSC");

        String p2 = C + "/payments/" + second;
        expect(call(finance, "POST", p2 + "/release", null), 200);
        expect(call(finance, "POST", p2 + "/simulate-response", "{\"outcome\":\"CONFIRMED\"}"), 200);

        MvcResult summary = call(authority, "GET", C + "/cases/" + caseId + "/payment-summary", null);
        expect(summary, 200);
        assertThat(summary.getResponse().getContentAsString()).contains("\"mode\":\"SIMULATED\"")
                .contains("\"confirmedAmount\":4700002.0").contains("\"failedAmount\":0");
        mockMvc.perform(get(p1 + "/events").header("Authorization", finance)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5));
        expect(call(consultant, "GET", p1 + "/receipt", null), 403);
        expect(call(consultant, "GET", C + "/cases/" + caseId + "/payments", null), 403);
    }

    @Test
    void rr_isAssessedApprovedByAnotherPerson_andDeliveredStepByStep() throws Exception {
        String[] owners = snapshotOwners();
        String relocation = "ITRELOC" + suffix;
        String livelihood = "ITLIVEL" + suffix;
//        expect(call(manager, "POST", C + "/rr/benefit-types", "{\"code\":\"" + relocation + "\",\"name\":\"DEMO relocation grant\","
//                + "\"kind\":\"ONE_TIME_CASH\",\"defaultAmount\":50000,\"requiresDisplaced\":true}"), 403);
        expect(call(manager, "POST", C + "/rr/benefit-types",
                "{\"code\":\"ITRELOC_DENIED\",\"name\":\"DEMO relocation grant\","
                        + "\"kind\":\"ONE_TIME_CASH\",\"defaultAmount\":50000,\"requiresDisplaced\":true}"), 403);
        String relocationId = id(call(ruleMaker, "POST", C + "/rr/benefit-types", "{\"code\":\"" + relocation
                + "\",\"name\":\"DEMO relocation grant\",\"kind\":\"ONE_TIME_CASH\",\"defaultAmount\":50000,\"requiresDisplaced\":true}"));
        String livelihoodId = id(call(ruleMaker, "POST", C + "/rr/benefit-types", "{\"code\":\"" + livelihood
                + "\",\"name\":\"DEMO livelihood allowance\",\"kind\":\"MONTHLY_ALLOWANCE\",\"defaultAmount\":3000,"
                + "\"defaultMonths\":12,\"requiresLivelihoodLost\":true}"));
        expect(call(ruleMaker, "POST", C + "/rr/benefit-types", "{\"code\":\"" + relocation + "\",\"name\":\"x\",\"kind\":\"OTHER\"}"), 409);

        String rrCases = C + "/cases/" + caseId + "/rr-cases";
        expect(call(manager, "POST", rrCases, "{\"landownerId\":\"" + UUID.randomUUID() + "\",\"displaced\":true,\"livelihoodLost\":false}"), 400);
        MvcResult identified = call(manager, "POST", rrCases, "{\"landownerId\":\"" + owners[0] + "\",\"displaced\":true,\"livelihoodLost\":false}");
        expect(identified, 201);
        String rr = id(identified);
        expect(call(manager, "POST", rrCases, "{\"landownerId\":\"" + owners[0] + "\",\"displaced\":true,\"livelihoodLost\":false}"), 409);

        String base = C + "/rr-cases/" + rr;
        expect(call(authority, "POST", base + "/approve", null), 409);
        expect(call(manager, "POST", base + "/entitlements", "{\"benefitTypeId\":\"" + livelihoodId + "\"}"), 400);
        MvcResult added = call(manager, "POST", base + "/entitlements", "{\"benefitTypeId\":\"" + relocationId + "\"}");
        expect(added, 201);
        assertThat(added.getResponse().getContentAsString()).contains("\"status\":\"ASSESSED\"").contains("\"amount\":50000")
                .doesNotContain("DEMO Owner");
        expect(call(manager, "POST", base + "/entitlements", "{\"benefitTypeId\":\"" + relocationId + "\"}"), 409);
        String entitlementId = JsonPath.read(added.getResponse().getContentAsString(), "$.entitlements[0].id");

//        String today = java.time.LocalDate.now().toString();
        String today = java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString();
        expect(call(manager, "POST", base + "/approve", null), 403);
        expect(call(manager, "POST", base + "/entitlements/" + entitlementId + "/deliver", "{\"deliveredOn\":\"" + today + "\"}"), 409);
        expect(call(authority, "POST", base + "/approve", null), 200);
        expect(call(manager, "POST", base + "/complete", null), 400);
        expect(call(manager, "POST", base + "/entitlements/" + entitlementId + "/deliver",
                "{\"deliveredOn\":\"" + java.time.LocalDate.now().plusDays(2) + "\"}"), 400);
        expect(call(manager, "POST", base + "/entitlements/" + entitlementId + "/deliver",
                "{\"deliveredOn\":\"" + today + "\",\"remarks\":\"DEMO: handed over\"}"), 200);
        expect(call(manager, "POST", base + "/entitlements/" + entitlementId + "/deliver", "{\"deliveredOn\":\"" + today + "\"}"), 409);
        MvcResult done = call(manager, "POST", base + "/complete", null);
        expect(done, 200);
        assertThat(done.getResponse().getContentAsString()).contains("\"status\":\"COMPLETED\"");

        expect(call(finance, "GET", rrCases, null), 200);
        expect(call(consultant, "GET", rrCases, null), 403);
    }
}