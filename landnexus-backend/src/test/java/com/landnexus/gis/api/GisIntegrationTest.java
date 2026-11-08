package com.landnexus.gis.api;

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

/** Real database with PostGIS, real filter chain, real tokens. Synthetic DEMO shapes only. */
@SpringBootTest
class GisIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String LR = "/api/v1/land-records";
    private static final String GIS = "/api/v1/gis";

    // about 1.16 hectares near 19.87 N, 75.34 E (a synthetic square, not a real parcel)
    private static final String SQUARE = "{\"type\":\"Polygon\",\"coordinates\":[[[75.3400,19.8700],[75.3410,19.8700],[75.3410,19.8710],[75.3400,19.8710],[75.3400,19.8700]]]}";
    private static final String BIGGER = "{\"type\":\"MultiPolygon\",\"coordinates\":[[[[75.3400,19.8700],[75.3412,19.8700],[75.3412,19.8710],[75.3400,19.8710],[75.3400,19.8700]]]]}";
    private static final String BOWTIE = "{\"type\":\"Polygon\",\"coordinates\":[[[75.340,19.870],[75.341,19.871],[75.341,19.870],[75.340,19.871],[75.340,19.870]]]}";
    private static final String SWAPPED = "{\"type\":\"Polygon\",\"coordinates\":[[[19.8700,75.3400],[19.8710,75.3400],[19.8710,75.3410],[19.8700,75.3410],[19.8700,75.3400]]]}";
    private static final String WITH_Z = "{\"type\":\"Polygon\",\"coordinates\":[[[75.3400,19.8700,500],[75.3410,19.8700,500],[75.3410,19.8710,500],[75.3400,19.8710,500],[75.3400,19.8700,500]]]}";
    private static final String LINE = "{\"type\":\"LineString\",\"coordinates\":[[75.30,19.80],[75.35,19.85],[75.40,19.90]]}";

    private static final String FOREST_SQUARE = "{\"type\":\"Polygon\",\"coordinates\":[[[75.3405,19.8702],[75.3415,19.8702],[75.3415,19.8708],[75.3405,19.8708],[75.3405,19.8702]]]}";
    private static final String THROUGH = "{\"type\":\"LineString\",\"coordinates\":[[75.3395,19.8705],[75.3415,19.8705]]}";

    @Autowired private WebApplicationContext context;
    @Autowired private UserAccountRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix, prefix, stateCode, village1, parcelId;
    private UUID projectId;
    private String field1, field2, finance, consultant;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it7-" + suffix.toLowerCase(Locale.ROOT) + "-";
        stateCode = "ITG" + suffix;

        String state = admin("/states", "{\"code\":\"" + stateCode + "\",\"name\":\"Gis Test State\"}");
        String district1 = admin("/districts", "{\"code\":\"D1\",\"name\":\"District One\",\"stateId\":\"" + state + "\"}");
        String district2 = admin("/districts", "{\"code\":\"D2\",\"name\":\"District Two\",\"stateId\":\"" + state + "\"}");
        String taluka1 = admin("/talukas", "{\"code\":\"T1\",\"name\":\"Taluka One\",\"districtId\":\"" + district1 + "\"}");
        village1 = admin("/villages", "{\"code\":\"V1\",\"name\":\"Village One\",\"talukaId\":\"" + taluka1 + "\"}");
        String ministry = admin("/ministries", "{\"code\":\"ITGM" + suffix + "\",\"name\":\"Test Ministry\"}");
        String department = admin("/departments", "{\"code\":\"ITGD" + suffix + "\",\"name\":\"Test Department\",\"ministryId\":\""
                + ministry + "\",\"level\":\"STATE\"}");

        UUID f1 = user("field1", "FIELD_OFFICER");
        UUID f2 = user("field2", "FIELD_OFFICER");
        UUID fin = user("finance", "FINANCE_OFFICER");
        UUID con = user("consultant", "CONSULTANT");
        scope(f1, district1);
        scope(f2, district2);
        scope(fin, district1);
        scope(con, district1);
        field1 = login("field1");
        field2 = login("field2");
        finance = login("finance");
        consultant = login("consultant");

        UUID proposalId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        jdbc.update("INSERT INTO proposals (id, proposal_number, title, project_type, status, version_no, state_id, district_id, "
                        + "department_id, estimated_land_area_ha, description, planned_start_date, planned_end_date, owner_user_id, submitted_at) "
                        + "VALUES (?, ?, 'DEMO IT proposal', 'STATE_HIGHWAY', 'APPROVED', 1, ?, ?, ?, 10, 'DEMO', DATE '2027-01-01', DATE '2028-01-01', ?, now())",
                proposalId, "PRP-IT7-" + suffix, UUID.fromString(state), UUID.fromString(district1), UUID.fromString(department), con);
        jdbc.update("INSERT INTO projects (id, code, proposal_id, title, project_type, status, state_id, district_id, department_id, "
                        + "estimated_land_area_ha, owner_user_id, approved_by_user_id, approved_at) "
                        + "VALUES (?, ?, ?, 'DEMO IT project', 'STATE_HIGHWAY', 'ACTIVE', ?, ?, ?, 10, ?, ?, now())",
                projectId, "PRJ-IT7-" + suffix, proposalId, UUID.fromString(state), UUID.fromString(district1),
                UUID.fromString(department), con, con);

        parcelId = JsonPath.read(call(field1, "POST", LR + "/parcels", "{\"villageId\":\"" + village1 + "\",\"gatNumber\":\"DEMO-801\",\"areaHa\":1.2,"
                + "\"classification\":\"AGRICULTURAL_DRY\",\"landUse\":\"CULTIVATION\"}").getResponse().getContentAsString(), "$.id");
    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        String parcels = "(SELECT p.id FROM land_parcels p JOIN districts d ON d.id = p.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)";
        try {
            jdbc.execute("ALTER TABLE parcel_boundaries DISABLE TRIGGER trg_parcel_boundaries_no_delete");
            jdbc.execute("ALTER TABLE project_alignments DISABLE TRIGGER trg_project_alignments_no_delete");
            jdbc.update("DELETE FROM parcel_boundaries WHERE parcel_id IN " + parcels, stateCode);
            jdbc.update("DELETE FROM project_alignments WHERE project_id = ?", projectId);
        } finally {
            jdbc.execute("ALTER TABLE parcel_boundaries ENABLE TRIGGER trg_parcel_boundaries_no_delete");
            jdbc.execute("ALTER TABLE project_alignments ENABLE TRIGGER trg_project_alignments_no_delete");
        }
        jdbc.update("DELETE FROM project_villages WHERE project_id = ?", projectId);
        jdbc.update("DELETE FROM projects WHERE id = ?", projectId);
        jdbc.update("DELETE FROM proposals WHERE proposal_number = ?", "PRP-IT7-" + suffix);
        jdbc.update("DELETE FROM land_parcels WHERE id IN " + parcels, stateCode);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", stateCode);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", stateCode);
        jdbc.update("DELETE FROM states WHERE code = ?", stateCode);
        jdbc.update("DELETE FROM departments WHERE code = ?", "ITGD" + suffix);
        jdbc.update("DELETE FROM ministries WHERE code = ?", "ITGM" + suffix);
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

    private void expect(MvcResult r, int code) throws Exception {
        assertThat(r.getResponse().getStatus())
                .as("%s %s -> body: %s", r.getRequest().getMethod(), r.getRequest().getRequestURI(), r.getResponse().getContentAsString())
                .isEqualTo(code);
    }

    private String body(MvcResult r) throws Exception {
        return r.getResponse().getContentAsString();
    }

    // ------------------------------------------------------------------ tests

    @Test
    void parcelBoundary_isCheckedByPostGis_versioned_andScoped() throws Exception {
        String path = GIS + "/parcels/" + parcelId + "/boundary";

        expect(call(field1, "PUT", path, BOWTIE), 400);
        expect(call(field1, "PUT", path, SWAPPED), 400);
        expect(call(field1, "PUT", path, WITH_Z), 400);
        expect(call(field1, "PUT", path, LINE), 400);
        expect(call(field1, "PUT", path, "not json at all"), 400);
        expect(call(finance, "PUT", path, SQUARE), 403);
        expect(call(consultant, "PUT", path, SQUARE), 403);
        expect(call(field2, "PUT", path, SQUARE), 404);
        expect(call(field1, "GET", path, null), 404);

        MvcResult first = call(field1, "PUT", path + "?sourceNote=DEMO%20survey", SQUARE);
        expect(first, 200);
        double area = JsonPath.<Number>read(body(first), "$.areaHa").doubleValue();
        assertThat(area).isBetween(1.0, 1.3);
        assertThat(JsonPath.<Number>read(body(first), "$.versionNo").intValue()).isEqualTo(1);
        assertThat(body(first)).contains("variancePercent");

        MvcResult second = call(field1, "PUT", path, BIGGER);
        expect(second, 200);
        assertThat(JsonPath.<Number>read(body(second), "$.versionNo").intValue()).isEqualTo(2);
        assertThat(JsonPath.<Number>read(body(second), "$.areaHa").doubleValue()).isGreaterThan(area);

        MvcResult feature = call(finance, "GET", path, null);
        expect(feature, 200);
        assertThat(body(feature)).contains("\"type\": \"Feature\"").contains("MultiPolygon").contains("\"versionNo\": 2");
        expect(call(field2, "GET", path, null), 404);

        MvcResult history = call(finance, "GET", path + "/history", null);
        expect(history, 200);
        assertThat(JsonPath.<Integer>read(body(history), "$.length()")).isEqualTo(2);
        assertThat(JsonPath.<Boolean>read(body(history), "$[0].current")).isTrue();

        MvcResult layer = call(finance, "GET", GIS + "/villages/" + village1 + "/parcels", null);
        expect(layer, 200);
        assertThat(body(layer)).contains("FeatureCollection").contains(parcelId);
        expect(call(field2, "GET", GIS + "/villages/" + village1 + "/parcels", null), 404);
    }

    @Test
    void projectAlignment_hasALengthInKm_andACorridorPolygon() throws Exception {
        String path = GIS + "/projects/" + projectId + "/alignment";

        expect(call(field1, "PUT", path + "?corridorWidthM=0", LINE), 400);
        expect(call(field1, "PUT", path + "?corridorWidthM=60", SQUARE), 400);
        expect(call(finance, "PUT", path + "?corridorWidthM=60", LINE), 403);
        expect(call(field2, "PUT", path + "?corridorWidthM=60", LINE), 404);
        expect(call(field1, "GET", path, null), 404);

        MvcResult set = call(field1, "PUT", path + "?corridorWidthM=60&sourceNote=DEMO", LINE);
        expect(set, 200);
        assertThat(JsonPath.<Number>read(body(set), "$.lengthKm").doubleValue()).isBetween(14.0, 17.0);

        MvcResult line = call(finance, "GET", path, null);
        expect(line, 200);
        assertThat(body(line)).contains("MultiLineString").contains("ALIGNMENT");
        MvcResult corridor = call(finance, "GET", GIS + "/projects/" + projectId + "/corridor", null);
        expect(corridor, 200);
        assertThat(body(corridor)).contains("Polygon").contains("CORRIDOR");
        expect(call(field2, "GET", GIS + "/projects/" + projectId + "/corridor", null), 404);
        expect(call(finance, "GET", path + "/history", null), 200);
    }

    @Test
    void conflictReport_findsCrossedParcels_forestOverlap_missingBoundaries_andDrawsTheMap() throws Exception {
        jdbc.update("INSERT INTO project_villages (project_id, village_id) VALUES (?, ?)", projectId, UUID.fromString(village1));
        String forest = JsonPath.read(call(field1, "POST", LR + "/parcels", "{\"villageId\":\"" + village1 + "\",\"gatNumber\":\"DEMO-802\","
                + "\"areaHa\":0.5,\"classification\":\"FOREST\",\"landUse\":\"VACANT\"}").getResponse().getContentAsString(), "$.id");
        expect(call(field1, "POST", LR + "/parcels", "{\"villageId\":\"" + village1 + "\",\"gatNumber\":\"DEMO-803\","
                + "\"areaHa\":0.5,\"classification\":\"AGRICULTURAL_DRY\",\"landUse\":\"CULTIVATION\"}"), 201);

        String conflicts = GIS + "/projects/" + projectId + "/conflicts";
        expect(call(field1, "GET", conflicts, null), 404);   // no alignment yet
        expect(call(field1, "PUT", GIS + "/parcels/" + parcelId + "/boundary", SQUARE), 200);
        expect(call(field1, "PUT", GIS + "/parcels/" + forest + "/boundary", FOREST_SQUARE), 200);
        expect(call(field1, "PUT", GIS + "/projects/" + projectId + "/alignment?corridorWidthM=60", THROUGH), 200);

        expect(call(consultant, "GET", conflicts, null), 403);
        expect(call(field2, "GET", conflicts, null), 404);
        MvcResult report = call(finance, "GET", conflicts, null);
        expect(report, 200);
        String json = body(report);
        assertThat(JsonPath.<Integer>read(json, "$.affectedParcelCount")).isEqualTo(2);
        assertThat(JsonPath.<Number>read(json, "$.parcelsInProjectVillages").intValue()).isEqualTo(3);
        assertThat(JsonPath.<Number>read(json, "$.parcelsWithBoundary").intValue()).isEqualTo(2);
        assertThat(JsonPath.<Integer>read(json, "$.warnings")).isGreaterThanOrEqualTo(2);
        assertThat(json).contains("FOREST_LAND").contains("PARCEL_OVERLAP").contains("NO_ACQUISITION_CASE_YET")
                .contains("PARCELS_WITHOUT_BOUNDARY").contains("limitations");
        java.util.List<Number> affected = JsonPath.read(json, "$.affectedParcels[?(@.gatNumber=='DEMO-801')].affectedHa");
        assertThat(affected.get(0).doubleValue()).isBetween(0.55, 0.70);   // about 105 m of corridor, 60 m wide

        MvcResult map = call(finance, "GET", GIS + "/projects/" + projectId + "/map", null);
        expect(map, 200);
        assertThat(body(map)).contains("FeatureCollection").contains("CORRIDOR").contains("ALIGNMENT").contains("PARCEL").contains(parcelId);
        expect(call(field2, "GET", GIS + "/projects/" + projectId + "/map", null), 404);
    }
}