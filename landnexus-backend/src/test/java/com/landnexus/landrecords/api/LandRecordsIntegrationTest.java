package com.landnexus.landrecords.api;

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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import com.landnexus.support.AbstractIsolatedPgIntegrationTest;
import org.junit.jupiter.api.AfterAll;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Real database, real filter chain, real tokens. Uses only synthetic DEMO data. */
@SpringBootTest
@ActiveProfiles("integration")
class LandRecordsIntegrationTest extends AbstractIsolatedPgIntegrationTest {

    private static final String PASSWORD = "Test-Passw0rd-123";
    private static final String ADMIN = "/api/v1/administration";
    private static final String LR = "/api/v1/land-records";

    private static final Path STORAGE = newTempDir();

    private static Path newTempDir() {
        try {
            return Files.createTempDirectory("landnexus-it-files");
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

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private UserAccountRepository users;
    @Autowired
    private RoleRepository roles;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JdbcTemplate jdbc;

    private MockMvc mockMvc;
    private String suffix;
    private String prefix;
    private String district1;
    private String village1;
    private String village2;
    private String field1;
    private String field2;
    private String finance;
    private String consultant;
    private String scrutiny;

    @BeforeEach
    void setUp() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        prefix = "it4-" + suffix.toLowerCase(Locale.ROOT) + "-";

        String state = admin("/states", "{\"code\":\"ITL" + suffix + "\",\"name\":\"Land Test State\"}");
        district1 = admin("/districts", "{\"code\":\"D1\",\"name\":\"District One\",\"stateId\":\"" + state + "\"}");
        String district2 = admin("/districts", "{\"code\":\"D2\",\"name\":\"District Two\",\"stateId\":\"" + state + "\"}");
        String taluka1 = admin("/talukas", "{\"code\":\"T1\",\"name\":\"Taluka One\",\"districtId\":\"" + district1 + "\"}");
        String taluka2 = admin("/talukas", "{\"code\":\"T2\",\"name\":\"Taluka Two\",\"districtId\":\"" + district2 + "\"}");
        village1 = admin("/villages", "{\"code\":\"V1\",\"name\":\"Village One\",\"talukaId\":\"" + taluka1 + "\"}");
        village2 = admin("/villages", "{\"code\":\"V2\",\"name\":\"Village Two\",\"talukaId\":\"" + taluka2 + "\"}");

        UUID f1 = user("field1", "FIELD_OFFICER");
        UUID f2 = user("field2", "FIELD_OFFICER");
        UUID fin = user("finance", "FINANCE_OFFICER");
        UUID con = user("consultant", "CONSULTANT");
        UUID sc = user("scrutiny", "SCRUTINY_OFFICER");
        scope(sc, district1);
        scope(f1, district1);
        scope(f2, district2);
        scope(fin, district1);
        scope(con, district1);
        field1 = login("field1");
        field2 = login("field2");
        finance = login("finance");
        consultant = login("consultant");
        scrutiny = login("scrutiny");

    }

    @AfterEach
    void cleanUp() {
        String like = prefix + "%";
        String owners = "(SELECT id FROM users WHERE username LIKE ?)";
        String parcels = "(SELECT p.id FROM land_parcels p JOIN districts d ON d.id = p.district_id "
                + "JOIN states s ON s.id = d.state_id WHERE s.code = ?)";
        String state = "ITL" + suffix;
        try {
            jdbc.execute("ALTER TABLE land_document_versions DISABLE TRIGGER trg_land_document_versions_append_only");
            jdbc.update("DELETE FROM land_document_versions WHERE document_id IN (SELECT id FROM land_documents WHERE parcel_id IN " + parcels + ")", state);
        } finally {
            jdbc.execute("ALTER TABLE land_document_versions ENABLE TRIGGER trg_land_document_versions_append_only");
        }
        jdbc.update("DELETE FROM land_documents WHERE parcel_id IN " + parcels, state);
        jdbc.update("DELETE FROM parcel_ownerships WHERE parcel_id IN " + parcels, state);
        jdbc.update("DELETE FROM parcel_mutations WHERE parcel_id IN " + parcels, state);
        jdbc.update("DELETE FROM revenue_records WHERE parcel_id IN " + parcels, state);
        jdbc.update("DELETE FROM land_parcels WHERE id IN " + parcels, state);
        jdbc.update("DELETE FROM landowners WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", state);
        jdbc.update("DELETE FROM user_geographic_scopes WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM user_roles WHERE user_id IN " + owners, like);
        jdbc.update("DELETE FROM users WHERE username LIKE ?", like);
        jdbc.update("DELETE FROM villages WHERE taluka_id IN (SELECT t.id FROM talukas t JOIN districts d ON d.id = t.district_id "
                + "JOIN states s ON s.id = d.state_id WHERE s.code = ?)", state);
        jdbc.update("DELETE FROM talukas WHERE district_id IN (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id WHERE s.code = ?)", state);
        jdbc.update("DELETE FROM districts WHERE state_id IN (SELECT id FROM states WHERE code = ?)", state);
        jdbc.update("DELETE FROM states WHERE code = ?", state);
    }

    // ------------------------------------------------------------------ helpers

    private RequestPostProcessor admin() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()).claim("username", "it-actor"))
                .authorities(new SimpleGrantedAuthority("ROLE_CENTRAL_ADMIN"),
                        new SimpleGrantedAuthority("MASTER_DATA_WRITE"), new SimpleGrantedAuthority("MASTER_DATA_READ"),
                        new SimpleGrantedAuthority("USER_WRITE"), new SimpleGrantedAuthority("USER_READ"),
                        new SimpleGrantedAuthority("AUDIT_READ"));
    }

    private String admin(String path, String json) throws Exception {
        MvcResult r = mockMvc.perform(post(ADMIN + path).with(admin()).contentType(MediaType.APPLICATION_JSON).content(json))
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
        mockMvc.perform(put(ADMIN + "/users/" + userId + "/scopes").with(admin()).contentType(MediaType.APPLICATION_JSON)
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
        assertThat(r.getResponse().getStatus()).as("%s", r.getRequest().getRequestURI()).isEqualTo(code);
    }

    private String id(MvcResult r) throws Exception {
        return JsonPath.read(r.getResponse().getContentAsString(), "$.id");
    }

    private static final byte[] PDF_BYTES = "%PDF-1.4\n% DEMO document\n".getBytes(StandardCharsets.US_ASCII);

    private MvcResult upload(String token, String path, String filename, String type, byte[] content,
                             String category, String title) throws Exception {
        var request = multipart(path).file(new MockMultipartFile("file", filename, type, content));
        if (category != null) {
            request = request.param("category", category).param("title", title);
        }
        return mockMvc.perform(request.header("Authorization", token)).andReturn();
    }

    private String parcelJson(String village, String gat, String area) {
        return "{\"villageId\":\"" + village + "\",\"gatNumber\":\"" + gat + "\",\"areaHa\":" + area
                + ",\"classification\":\"AGRICULTURAL_DRY\",\"landUse\":\"CULTIVATION\"}";
    }

    private String ownerJson(String name) {
        return "{\"districtId\":\"" + district1 + "\",\"ownerType\":\"INDIVIDUAL\",\"fullName\":\"" + name
                + "\",\"phone\":\"+91 90000 00000\"}";
    }

    private String shareJson(String ownerId, String share) {
        return "{\"landownerId\":\"" + ownerId + "\",\"sharePercent\":" + share
                + ",\"basis\":\"ORIGINAL\",\"fromDate\":\"2020-01-01\"}";
    }

    // ------------------------------------------------------------------ tests

    @Test
    void parcels_followUniquenessAndGeographicScope() throws Exception {
        MvcResult created = call(field1, "POST", LR + "/parcels", parcelJson(village1, "DEMO-101", "1.2500"));
        expect(created, 201);
        String parcelId = id(created);

        expect(call(field1, "POST", LR + "/parcels", parcelJson(village1, "demo-101", "2")), 409);
        expect(call(field1, "POST", LR + "/parcels", parcelJson(village1, "", "2")), 400);
        expect(call(field2, "GET", LR + "/parcels/" + parcelId, null), 404);
        expect(call(field2, "POST", LR + "/parcels", parcelJson(village1, "DEMO-202", "2")), 403);
        expect(call(consultant, "GET", LR + "/parcels/" + parcelId, null), 403);
        expect(call(consultant, "POST", LR + "/parcels", parcelJson(village1, "DEMO-303", "2")), 403);

        expect(call(field1, "PUT", LR + "/parcels/" + parcelId, parcelJson(village1, "DEMO-101", "3.5000")), 200);
        expect(call(field1, "PUT", LR + "/parcels/" + parcelId, parcelJson(village2, "DEMO-101", "3.5000")), 400);

        mockMvc.perform(get(LR + "/parcels").header("Authorization", field1).param("number", "demo-101"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get(LR + "/parcels").header("Authorization", field2))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void ownership_neverExceedsOneHundredPercent_andOwnerNamesAreMasked() throws Exception {
        String parcelId = id(call(field1, "POST", LR + "/parcels", parcelJson(village1, "DEMO-111", "2")));
        String ownerA = id(call(field1, "POST", LR + "/landowners", ownerJson("DEMO Owner One")));
        String ownerB = id(call(field1, "POST", LR + "/landowners", ownerJson("DEMO Owner Two")));

        MvcResult first = call(field1, "POST", LR + "/parcels/" + parcelId + "/ownerships", shareJson(ownerA, "60"));
        expect(first, 201);
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/ownerships", shareJson(ownerB, "50")), 400);
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/ownerships", shareJson(ownerA, "10")), 409);
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/ownerships", shareJson(ownerB, "40")), 201);

        // a finance officer sees the shares but not who the owners are
        mockMvc.perform(get(LR + "/parcels/" + parcelId + "/ownerships").header("Authorization", finance))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].ownerName").doesNotExist());
        expect(call(finance, "GET", LR + "/landowners/" + ownerA, null), 403);
        expect(call(finance, "GET", LR + "/landowners", null), 403);

        // a field officer sees the names
        mockMvc.perform(get(LR + "/parcels/" + parcelId + "/ownerships").header("Authorization", field1))
                .andExpect(jsonPath("$[0].ownerName").value("DEMO Owner One"));

        String ownershipId = id(first);
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/ownerships/" + ownershipId + "/end",
                "{\"endDate\":\"2024-01-01\"}"), 200);
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/ownerships/" + ownershipId + "/end",
                "{\"endDate\":\"2024-02-01\"}"), 409);
        // the freed share can now be used
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/ownerships", shareJson(ownerA, "60")), 201);
    }

    @Test
    void mutationsAndRevenueRecords_followTheirRules() throws Exception {
        String parcelId = id(call(field1, "POST", LR + "/parcels", parcelJson(village1, "DEMO-121", "2")));
        String mutation = "{\"mutationNumber\":\"m-77\",\"mutationDate\":\"2023-05-01\",\"mutationType\":\"SALE\",\"description\":\"DEMO\"}";
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/mutations", mutation), 201);
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/mutations", mutation), 409);

        String eightA = "{\"recordType\":\"EIGHT_A\",\"extractDate\":\"2024-01-01\",\"particulars\":\"DEMO extract\"}";
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/revenue-records", eightA), 400);
        String sevenTwelve = "{\"recordType\":\"SEVEN_TWELVE\",\"extractDate\":\"2024-01-01\",\"particulars\":\"DEMO extract\"}";
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/revenue-records", sevenTwelve), 201);
        expect(call(field1, "POST", LR + "/parcels/" + parcelId + "/revenue-records", sevenTwelve), 409);

        mockMvc.perform(get(LR + "/parcels/" + parcelId + "/mutations").header("Authorization", finance))
                .andExpect(jsonPath("$[0].mutationNumber").value("M-77"));
        expect(call(field2, "GET", LR + "/parcels/" + parcelId + "/revenue-records", null), 404);
    }

    @Test
    void landownerViews_areAudited_withoutPersonalDataInTheAuditText() throws Exception {
        String ownerId = id(call(field1, "POST", LR + "/landowners", ownerJson("DEMO Secret Name")));
        expect(call(field1, "GET", LR + "/landowners/" + ownerId, null), 200);
        expect(call(field2, "GET", LR + "/landowners/" + ownerId, null), 404);

        MvcResult audit = mockMvc.perform(get(ADMIN + "/audit-events").with(admin())
                        .param("entityType", "Landowner").param("entityId", ownerId))
                .andExpect(status().isOk()).andReturn();
        String body = audit.getResponse().getContentAsString();
        assertThat(body).contains("\"action\":\"VIEW\"").contains("\"action\":\"CREATE\"");
        assertThat(body).doesNotContain("DEMO Secret Name").doesNotContain("90000");
    }

    @Test
    void documents_areValidated_versioned_verifiedByAnotherPerson_andDownloadsAreAudited() throws Exception {
        String parcelId = id(call(field1, "POST", LR + "/parcels", parcelJson(village1, "DEMO-901", "2")));
        String docs = LR + "/parcels/" + parcelId + "/documents";

        // bad files never get in
        expect(upload(field1, docs, "evil.pdf", "application/pdf", new byte[] {0x4D, 0x5A, (byte) 0x90, 0}, "SURVEY_MAP", "DEMO"), 400);
        expect(upload(field1, docs, "notes.pdf", "application/pdf", "hello world".getBytes(), "SURVEY_MAP", "DEMO"), 400);
        expect(upload(field1, docs, "deed.exe", "application/pdf", PDF_BYTES, "SURVEY_MAP", "DEMO"), 400);
        expect(upload(field1, docs, "empty.pdf", "application/pdf", new byte[0], "SURVEY_MAP", "DEMO"), 400);
        // roles without upload permission, and a consultant, are refused
        expect(upload(finance, docs, "deed.pdf", "application/pdf", PDF_BYTES, "SURVEY_MAP", "DEMO"), 403);
        expect(upload(consultant, docs, "deed.pdf", "application/pdf", PDF_BYTES, "SURVEY_MAP", "DEMO"), 403);
        // another district cannot even see the parcel
        expect(upload(field2, docs, "deed.pdf", "application/pdf", PDF_BYTES, "SURVEY_MAP", "DEMO"), 404);

        MvcResult created = upload(field1, docs, "survey map.pdf", "application/pdf", PDF_BYTES, "SURVEY_MAP", "DEMO survey map");
        expect(created, 201);
        String docId = id(created);
        assertThat(created.getResponse().getContentAsString())
                .contains("\"verificationStatus\":\"PENDING\"").doesNotContain("stored").doesNotContain(".bin");

        // download returns the exact bytes, with safe headers
        MvcResult download = call(field1, "GET", LR + "/documents/" + docId + "/versions/1/download", null);
        expect(download, 200);
        assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(PDF_BYTES);
        assertThat(download.getResponse().getContentType()).startsWith("application/pdf");
        assertThat(download.getResponse().getHeader("Content-Disposition")).contains("attachment");
        assertThat(download.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");

        // finance has no document permission; the other district gets "not found"
        expect(call(finance, "GET", LR + "/documents/" + docId, null), 403);
        expect(call(finance, "GET", LR + "/documents/" + docId + "/versions/1/download", null), 403);
        expect(call(field2, "GET", LR + "/documents/" + docId, null), 404);
        expect(call(field2, "GET", LR + "/documents/" + docId + "/versions/1/download", null), 404);

        // manual verification: the uploader's role cannot verify; another person can
        expect(call(field1, "POST", LR + "/documents/" + docId + "/verify", null), 403);
        expect(call(scrutiny, "POST", LR + "/documents/" + docId + "/reject", "{\"remarks\":\"\"}"), 400);
        expect(call(scrutiny, "POST", LR + "/documents/" + docId + "/verify", "{\"remarks\":\"Checked\"}"), 200);
        expect(call(scrutiny, "POST", LR + "/documents/" + docId + "/verify", null), 409);

        // a new version resets the decision
        MvcResult v2 = upload(field1, LR + "/documents/" + docId + "/versions", "survey map v2.pdf", "application/pdf",
                "%PDF-1.4\n% DEMO v2\n".getBytes(StandardCharsets.US_ASCII), null, null);
        expect(v2, 201);
        mockMvc.perform(get(LR + "/documents/" + docId).header("Authorization", field1))
                .andExpect(jsonPath("$.currentVersionNo").value(2))
                .andExpect(jsonPath("$.verificationStatus").value("PENDING"))
                .andExpect(jsonPath("$.versions.length()").value(2));

        // the scrutiny officer's own upload cannot be verified by the same person
        String ownDoc = id(upload(scrutiny, docs, "own.pdf", "application/pdf", PDF_BYTES, "NOTICE", "DEMO own"));
        expect(call(scrutiny, "POST", LR + "/documents/" + ownDoc + "/verify", null), 403);

        MvcResult audit = mockMvc.perform(get(ADMIN + "/audit-events").with(admin())
                        .param("entityType", "LandDocument").param("entityId", docId))
                .andExpect(status().isOk()).andReturn();
        assertThat(audit.getResponse().getContentAsString())
                .contains("\"action\":\"DOWNLOAD\"").contains("\"action\":\"VERIFY\"").contains("\"action\":\"NEW_VERSION\"");
    }
}