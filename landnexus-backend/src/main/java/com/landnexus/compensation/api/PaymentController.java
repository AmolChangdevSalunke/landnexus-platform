package com.landnexus.compensation.api;

import com.landnexus.compensation.api.dto.PaymentRrDtos.PaymentEventResponse;
import com.landnexus.compensation.api.dto.PaymentRrDtos.PaymentResponse;
import com.landnexus.compensation.api.dto.PaymentRrDtos.PaymentSummary;
import com.landnexus.compensation.api.dto.PaymentRrDtos.PaymentGenerationRequest;
import com.landnexus.compensation.api.dto.PaymentRrDtos.SimulateRequest;
import com.landnexus.compensation.application.PaymentService;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** SIMULATED payments. Every response says mode SIMULATED; nothing here moves real money. */
@RestController
@RequestMapping("/api/v1/compensation")
public class PaymentController {

    private final PaymentService payments;

    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    @PreAuthorize("hasAuthority('PAYMENT_RELEASE')")
    @PostMapping("/valuations/{valuationId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public List<PaymentResponse> generate(@PathVariable UUID valuationId,
                                          @RequestBody(required = false) @Valid PaymentGenerationRequest request,
                                          Authentication a) {
        return payments.generate(valuationId,
                request == null ? com.landnexus.compensation.domain.PaymentChannel.UNCLASSIFIED : request.paymentChannel(),
                CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('PAYMENT_READ')")
    @GetMapping("/cases/{caseId}/payments")
    public List<PaymentResponse> list(@PathVariable UUID caseId, Authentication a) {
        return payments.listForCase(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('PAYMENT_READ')")
    @GetMapping("/cases/{caseId}/payment-summary")
    public PaymentSummary summary(@PathVariable UUID caseId, Authentication a) {
        return payments.summary(caseId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('PAYMENT_READ')")
    @GetMapping("/payments/{id}/events")
    public List<PaymentEventResponse> events(@PathVariable UUID id, Authentication a) {
        return payments.eventsOf(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('PAYMENT_READ')")
    @GetMapping(value = "/payments/{id}/receipt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<byte[]> receipt(@PathVariable UUID id, Authentication a) {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "plain", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"nlams-simulated-payment-" + id + ".txt\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(payments.receipt(id, CurrentActor.from(a)));
    }

    @PreAuthorize("hasAuthority('PAYMENT_RELEASE')")
    @PostMapping("/payments/{id}/release")
    public PaymentResponse release(@PathVariable UUID id, Authentication a) {
        return payments.release(id, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('PAYMENT_RELEASE')")
    @PostMapping("/payments/{id}/simulate-response")
    public PaymentResponse simulate(@PathVariable UUID id, @Valid @RequestBody SimulateRequest r, Authentication a) {
        return payments.simulateResponse(id, r.outcome(), r.reason(), CurrentActor.from(a));
    }
}