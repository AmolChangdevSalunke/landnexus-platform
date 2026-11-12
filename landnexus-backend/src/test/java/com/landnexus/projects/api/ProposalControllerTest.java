package com.landnexus.projects.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.landnexus.projects.api.dto.ProposalResponse;
import com.landnexus.projects.application.ProposalService;
import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProposalWorkflow;
import com.landnexus.shared.exception.ApiExceptionHandler;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ProposalControllerTest {

    private static final String BASE = "/api/v1/projects/proposals";

    @Mock private ProposalService service;

    private MockMvc mockMvc;
    private JwtAuthenticationToken caller;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ProposalController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
        Jwt jwt = Jwt.withTokenValue("t").header("alg", "HS256")
                .subject(UUID.randomUUID().toString()).claim("username", "consultant")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(900)).build();
        caller = new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("PROPOSAL_CREATE")));
    }

    private ProposalResponse sample(UUID id) {
        return new ProposalResponse(id, null, "State Highway", ProjectType.STATE_HIGHWAY, ProposalStatus.DRAFT, 0,
                UUID.randomUUID(), UUID.randomUUID(), null, UUID.randomUUID(), new BigDecimal("60"),
                new BigDecimal("150"), Set.of(UUID.randomUUID()), null, "desc", LocalDate.of(2027, 1, 1),
                LocalDate.of(2028, 1, 1), UUID.randomUUID(), null, Instant.now(), Instant.now(), null, null,
                List.of("SUBMIT"));
    }

    private static String body(String district, String type, String title) {
        return "{\"title\":" + title + ",\"projectType\":\"" + type + "\",\"districtId\":\"" + district
                + "\",\"departmentId\":\"" + UUID.randomUUID() + "\",\"lengthKm\":60,\"estimatedLandAreaHa\":150,"
                + "\"villageIds\":[\"" + UUID.randomUUID() + "\"],\"description\":\"desc\","
                + "\"plannedStartDate\":\"2027-01-01\",\"plannedEndDate\":\"2028-01-01\"}";
    }

    @Test
    void create_validRequest_returns201() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.create(any(), any())).thenReturn(sample(id));

        mockMvc.perform(post(BASE).principal(caller).contentType(MediaType.APPLICATION_JSON)
                        .content(body(UUID.randomUUID().toString(), "STATE_HIGHWAY", "\"State Highway\"")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.availableActions[0]").value("SUBMIT"));
    }

    @Test
    void create_blankTitle_returns400WithFieldError() throws Exception {
        mockMvc.perform(post(BASE).principal(caller).contentType(MediaType.APPLICATION_JSON)
                        .content(body(UUID.randomUUID().toString(), "STATE_HIGHWAY", "\"\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='title')]").exists());
        verifyNoInteractions(service);
    }

    @Test
    void create_unknownProjectType_returns400() throws Exception {
        mockMvc.perform(post(BASE).principal(caller).contentType(MediaType.APPLICATION_JSON)
                        .content(body(UUID.randomUUID().toString(), "SPACE_STATION", "\"Title\"")))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void create_missingVillages_returns400() throws Exception {
        String noVillages = "{\"title\":\"T\",\"projectType\":\"DAM\",\"districtId\":\"" + UUID.randomUUID()
                + "\",\"departmentId\":\"" + UUID.randomUUID() + "\",\"estimatedLandAreaHa\":10,\"villageIds\":[],"
                + "\"description\":\"d\",\"plannedStartDate\":\"2027-01-01\",\"plannedEndDate\":\"2028-01-01\"}";

        mockMvc.perform(post(BASE).principal(caller).contentType(MediaType.APPLICATION_JSON).content(noVillages))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='villageIds')]").exists());
    }

    @Test
    void create_negativeLandArea_returns400() throws Exception {
        String bad = body(UUID.randomUUID().toString(), "DAM", "\"T\"").replace("\"estimatedLandAreaHa\":150", "\"estimatedLandAreaHa\":-5");

        mockMvc.perform(post(BASE).principal(caller).contentType(MediaType.APPLICATION_JSON).content(bad))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='estimatedLandAreaHa')]").exists());
    }

    @Test
    void get_unknownProposal_returns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.get(eq(id), any())).thenThrow(new ResourceNotFoundException("not found"));

        mockMvc.perform(get(BASE + "/" + id).principal(caller)).andExpect(status().isNotFound());
    }

    @Test
    void get_malformedId_returns400() throws Exception {
        mockMvc.perform(get(BASE + "/not-a-uuid").principal(caller)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void submit_inTheWrongState_returns409() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.transition(eq(id), eq(ProposalWorkflow.SUBMIT), any(), any()))
                .thenThrow(new InvalidTransitionException("Action SUBMIT is not allowed while the status is SUBMITTED"));

        mockMvc.perform(post(BASE + "/" + id + "/submit").principal(caller))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void clarification_withoutABody_returns400() throws Exception {
        mockMvc.perform(post(BASE + "/" + UUID.randomUUID() + "/clarification").principal(caller)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void approve_withoutABody_isAllowed() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.transition(eq(id), eq(ProposalWorkflow.APPROVE), any(), any())).thenReturn(sample(id));

        mockMvc.perform(post(BASE + "/" + id + "/approve").principal(caller))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()));
    }
}
