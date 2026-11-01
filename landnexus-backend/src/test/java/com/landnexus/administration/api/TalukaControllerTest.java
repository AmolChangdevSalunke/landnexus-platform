package com.landnexus.administration.api;

import com.landnexus.shared.exception.ApiExceptionHandler;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.administration.api.dto.TalukaRequest;
import com.landnexus.administration.api.dto.TalukaResponse;
import com.landnexus.administration.application.TalukaService;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class TalukaControllerTest {

    private static final String BASE = "/api/v1/administration/talukas";

    @Mock
    private TalukaService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TalukaController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    private TalukaResponse sample(UUID id) {
        return new TalukaResponse(id, "ABC1", "Sample", RecordStatus.ACTIVE, UUID.randomUUID(), "Parent", Instant.now(), Instant.now());
    }

    @Test
    void create_validRequest_returns201() throws Exception {
        String pid = UUID.randomUUID().toString();
        UUID id = UUID.randomUUID();
        when(service.create(any(TalukaRequest.class))).thenReturn(sample(id));

        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{ \"code\": \"ABC1\", \"name\": \"Sample\", \"districtId\": \"{PID}\" }".replace("{PID}", pid)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.code").value("ABC1"));
    }

    @Test
    void create_blankCode_returns400WithFieldError() throws Exception {
        String pid = UUID.randomUUID().toString();
        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{ \"code\": \"\", \"name\": \"Sample\", \"districtId\": \"{PID}\" }".replace("{PID}", pid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='code')]").exists());
        verifyNoInteractions(service);
    }

    @Test
    void create_missingRequiredDistrictId_returns400() throws Exception {
        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{ \"code\": \"ABC1\", \"name\": \"Sample\" }"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='districtId')]").exists());
        verifyNoInteractions(service);
    }

    @Test
    void create_duplicate_returns409() throws Exception {
        String pid = UUID.randomUUID().toString();
        when(service.create(any(TalukaRequest.class))).thenThrow(new DuplicateResourceException("duplicate"));

        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{ \"code\": \"ABC1\", \"name\": \"Sample\", \"districtId\": \"{PID}\" }".replace("{PID}", pid)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("duplicate"));
    }

    @Test
    void get_unknownId_returns404() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.get(id)).thenThrow(new ResourceNotFoundException("not found"));

        mockMvc.perform(get(BASE + "/" + id))
                .andExpect(status().isNotFound());
    }

    @Test
    void get_malformedId_returns400() throws Exception {
        mockMvc.perform(get(BASE + "/not-a-uuid"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void list_returnsPageShape() throws Exception {
        when(service.list(any(), anyInt(), anyInt()))
                .thenReturn(new PageResponse<>(List.of(sample(UUID.randomUUID())), 0, 20, 1L, 1));

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].code").value("ABC1"));
    }
}
