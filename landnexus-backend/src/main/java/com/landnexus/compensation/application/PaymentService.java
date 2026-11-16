package com.landnexus.compensation.application;

import com.landnexus.acquisition.application.AcquisitionLookupService;
import com.landnexus.acquisition.application.AcquisitionLookupService.CaseRef;
import com.landnexus.compensation.api.dto.PaymentRrDtos.PaymentEventResponse;
import com.landnexus.compensation.api.dto.PaymentRrDtos.PaymentResponse;
import com.landnexus.compensation.api.dto.PaymentRrDtos.PaymentSummary;
import com.landnexus.compensation.application.PaymentSplitter.Part;
import com.landnexus.compensation.application.PaymentSplitter.Share;
import com.landnexus.compensation.domain.CompTypes.PaymentStatus;
import com.landnexus.compensation.domain.CompTypes.ValuationStatus;
import com.landnexus.compensation.domain.CompensationPayment;
import com.landnexus.compensation.domain.PaymentChannel;
import com.landnexus.compensation.domain.PaymentEvent;
import com.landnexus.compensation.domain.Valuation;
import com.landnexus.compensation.infrastructure.CompensationPaymentRepository;
import com.landnexus.compensation.infrastructure.PaymentEventRepository;
import com.landnexus.compensation.infrastructure.PaymentGateway;
import com.landnexus.compensation.infrastructure.PaymentGateway.Instruction;
import com.landnexus.compensation.infrastructure.PaymentGateway.Receipt;
import com.landnexus.compensation.infrastructure.ValuationRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payments for an approved estimate: split by the ownership snapshot of Module 4, released through the SIMULATED
 * gateway, answered in simulation. Audit text holds ids and amounts, never names. The person who releases a
 * payment cannot be the one who prepared or approved the estimate.
 */
@Service
@Transactional(readOnly = true)
public class PaymentService {

    private static final String ENTITY = "CompensationPayment";
    private static final String READ = "PAYMENT_READ";

    private final CompensationPaymentRepository payments;
    private final PaymentEventRepository events;
    private final ValuationRepository valuations;
    private final AcquisitionLookupService acquisition;
    private final PaymentGateway gateway;
    private final CompensationAccess access;
    private final AuditService audit;
    private final Clock clock;

    public PaymentService(CompensationPaymentRepository payments, PaymentEventRepository events,
                          ValuationRepository valuations, AcquisitionLookupService acquisition, PaymentGateway gateway,
                          CompensationAccess access, AuditService audit, Clock clock) {
        this.payments = payments;
        this.events = events;
        this.valuations = valuations;
        this.acquisition = acquisition;
        this.gateway = gateway;
        this.access = access;
        this.audit = audit;
        this.clock = clock;
    }

    public List<PaymentResponse> listForCase(UUID caseId, CurrentActor actor) {
        requireCase(caseId, actor);
        return payments.findByCaseIdOrderByCreatedAtAsc(caseId).stream().map(p -> toResponse(p, actor)).toList();
    }

    public List<PaymentEventResponse> eventsOf(UUID paymentId, CurrentActor actor) {
        CompensationPayment p = load(paymentId, actor);
        return events.findByPaymentIdOrderByOccurredAtAsc(p.getId()).stream()
                .map(e -> new PaymentEventResponse(e.getId(), e.getFromStatus(), e.getToStatus(), e.getEvent(),
                        e.getActorUsername(), e.getDetail(), e.getOccurredAt())).toList();
    }

    @Transactional
    public byte[] receipt(UUID paymentId, CurrentActor actor) {
        CompensationPayment payment = load(paymentId, actor);
        CaseRef caseRef = requireCase(payment.getCaseId(), actor);
        String receipt = """
                LANDNEXUS - DEMO / SIMULATED PAYMENT RECORD
                This record is for demonstration only. No money was transferred through PFMS or any bank.

                Transaction reference: %s
                Payment ID: %s
                Acquisition case: %s
                Beneficiary reference: DEMO-%s
                Amount (INR): %s
                Status: %s
                Mode: %s
                Attempts: %d
                Created: %s
                Released: %s
                Confirmed: %s
                """.formatted(
                printable(payment.getReference()),
                payment.getId(),
                caseRef.caseNumber(),
                payment.getLandownerId().toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT),
                payment.getAmount().toPlainString(),
                payment.getStatus(),
                payment.getMode(),
                payment.getAttemptCount(),
                DateTimeFormatter.ISO_INSTANT.format(payment.getCreatedAt()),
                printableInstant(payment.getReleasedAt()),
                printableInstant(payment.getConfirmedAt()));
        audit.record("DOWNLOAD_PAYMENT_RECEIPT", ENTITY, paymentId,
                "status=" + payment.getStatus() + ", mode=" + payment.getMode());
        return receipt.getBytes(StandardCharsets.UTF_8);
    }

    public PaymentSummary summary(UUID caseId, CurrentActor actor) {
        requireCase(caseId, actor);
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal instructed = BigDecimal.ZERO;
        BigDecimal sent = BigDecimal.ZERO;
        BigDecimal confirmed = BigDecimal.ZERO;
        BigDecimal failed = BigDecimal.ZERO;
        List<CompensationPayment> rows = payments.findByCaseIdOrderByCreatedAtAsc(caseId);
        for (CompensationPayment p : rows) {
            total = total.add(p.getAmount());
            switch (p.getStatus()) {
                case INSTRUCTED -> instructed = instructed.add(p.getAmount());
                case SENT -> sent = sent.add(p.getAmount());
                case CONFIRMED -> confirmed = confirmed.add(p.getAmount());
                case FAILED -> failed = failed.add(p.getAmount());
            }
        }
        return new PaymentSummary(caseId, gateway.mode(), rows.size(), total, instructed, sent, confirmed, failed);
    }

    /** Creates one payment instruction per owner of the parcel (from the snapshot), once per approved estimate. */
    @Transactional
    public List<PaymentResponse> generate(UUID valuationId, PaymentChannel paymentChannel, CurrentActor actor) {
        if (paymentChannel == null) {
            throw new InvalidRequestException("A simulated payment channel must be selected");
        }
        Valuation v = valuations.findById(valuationId)
                .orElseThrow(() -> new ResourceNotFoundException("Estimate not found: " + valuationId));
        requireCase(v.getCaseId(), actor);
        if (v.getStatus() != ValuationStatus.APPROVED) {
            throw new InvalidTransitionException("Payments can be generated only for an approved estimate");
        }
        if (payments.existsByValuationId(valuationId)) {
            throw new DuplicateResourceException("Payments have already been generated for this estimate");
        }
        List<Share> shares = acquisition.ownerSnapshot(v.getCaseParcelId()).stream()
                .map(o -> new Share(o.landownerId(), o.sharePercent())).toList();
        List<Part> parts;
        try {
            parts = PaymentSplitter.split(v.getTotalAmount(), shares);
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Payments cannot be generated: " + e.getMessage());
        }
        List<PaymentResponse> result = new ArrayList<>();
        for (Part part : parts) {
            CompensationPayment saved = payments.saveAndFlush(new CompensationPayment(valuationId, v.getCaseId(),
                    v.getCaseParcelId(), part.landownerId(), part.percent(), part.amount(), paymentChannel));
            events.save(new PaymentEvent(saved.getId(), null, PaymentStatus.INSTRUCTED, "INSTRUCTED", actor.userId(),
                    actor.username(), "share=" + part.percent() + "%", clock.instant()));
            result.add(toResponse(saved, actor));
        }
        audit.record("GENERATE_PAYMENTS", ENTITY, valuationId, "payments=" + parts.size() + ", total=" + v.getTotalAmount()
                + ", mode=" + gateway.mode());
        return result;
    }

    /** INSTRUCTED to SENT, or FAILED to SENT again (a retry). */
    @Transactional
    public PaymentResponse release(UUID paymentId, CurrentActor actor) {
        CompensationPayment p = load(paymentId, actor);
        if (p.getStatus() != PaymentStatus.INSTRUCTED && p.getStatus() != PaymentStatus.FAILED) {
            throw new InvalidTransitionException("A " + p.getStatus() + " payment cannot be released");
        }
        Valuation v = valuations.findById(p.getValuationId())
                .orElseThrow(() -> new ResourceNotFoundException("Estimate not found: " + p.getValuationId()));
        if (actor.userId().equals(v.getPreparedByUserId()) || actor.userId().equals(v.getDecidedByUserId())) {
            throw new AccessDeniedException("The person who prepared or approved the estimate cannot release its payments");
        }
        Receipt receipt = gateway.submit(new Instruction(p.getId(), p.getLandownerId(), p.getAmount()));
        PaymentStatus from = p.getStatus();
        boolean retry = from == PaymentStatus.FAILED;
        p.markSent(receipt.reference(), receipt.mode(), actor.userId(), clock.instant());
        CompensationPayment saved = payments.saveAndFlush(p);
        events.save(new PaymentEvent(paymentId, from, PaymentStatus.SENT, retry ? "RETRY" : "RELEASE", actor.userId(),
                actor.username(), "reference=" + receipt.reference() + ", mode=" + receipt.mode(), clock.instant()));
        audit.record(retry ? "RETRY_PAYMENT" : "RELEASE_PAYMENT", ENTITY, paymentId, "amount=" + p.getAmount() + ", mode="
                + receipt.mode() + ", reference=" + receipt.reference());
        return toResponse(saved, actor);
    }

    /** Stands in for the answer a real payment system would send back. Only possible in SIMULATED mode. */
    @Transactional
    public PaymentResponse simulateResponse(UUID paymentId, PaymentStatus outcome, String reason, CurrentActor actor) {
        if (!"SIMULATED".equals(gateway.mode())) {
            throw new InvalidTransitionException("Responses can be simulated only in SIMULATED mode");
        }
        if (outcome != PaymentStatus.CONFIRMED && outcome != PaymentStatus.FAILED) {
            throw new InvalidRequestException("The outcome must be CONFIRMED or FAILED");
        }
        String why = reason == null || reason.isBlank() ? null : reason.trim();
        if (outcome == PaymentStatus.FAILED && why == null) {
            throw new InvalidRequestException("A reason is required for a failed payment");
        }
        CompensationPayment p = load(paymentId, actor);
        if (p.getStatus() != PaymentStatus.SENT) {
            throw new InvalidTransitionException("Only a SENT payment can receive a response");
        }
        PaymentStatus from = p.getStatus();
        if (outcome == PaymentStatus.CONFIRMED) {
            p.confirm(clock.instant());
        } else {
            p.fail(why);
        }
        CompensationPayment saved = payments.saveAndFlush(p);
        events.save(new PaymentEvent(paymentId, from, outcome, "SIMULATED_" + outcome.name(), actor.userId(),
                actor.username(), why, clock.instant()));
        audit.record("SIMULATE_" + outcome.name(), ENTITY, paymentId, "amount=" + p.getAmount() + (why == null ? "" : ", reason=" + why));
        return toResponse(saved, actor);
    }

    private CaseRef requireCase(UUID caseId, CurrentActor actor) {
        return acquisition.findCase(caseId).filter(c -> access.canView(actor, c.districtId(), READ))
                .orElseThrow(() -> new ResourceNotFoundException("Case not found: " + caseId));
    }

    private CompensationPayment load(UUID id, CurrentActor actor) {
        CompensationPayment p = payments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + id));
        requireCase(p.getCaseId(), actor);
        return p;
    }

    private PaymentResponse toResponse(CompensationPayment p, CurrentActor actor) {
        List<String> actions = new ArrayList<>();
        if (actor.hasAuthority("PAYMENT_RELEASE")) {
            if (p.getStatus() == PaymentStatus.INSTRUCTED) {
                actions.add("RELEASE");
            } else if (p.getStatus() == PaymentStatus.FAILED) {
                actions.add("RETRY");
            } else if (p.getStatus() == PaymentStatus.SENT) {
                actions.add("SIMULATE_CONFIRMED");
                actions.add("SIMULATE_FAILED");
            }
        }
        return new PaymentResponse(p.getId(), p.getValuationId(), p.getCaseId(), p.getCaseParcelId(), p.getLandownerId(),
                p.getSharePercent(), p.getAmount(), p.getStatus(), p.getPaymentChannel(), p.getMode(), p.getReference(), p.getFailureReason(),
                p.getAttemptCount(), p.getReleasedAt(), p.getConfirmedAt(), actions);
    }

    private static String printable(String value) {
        return value == null || value.isBlank() ? "Not assigned" : value;
    }

    private static String printableInstant(java.time.Instant value) {
        return value == null ? "Not recorded" : DateTimeFormatter.ISO_INSTANT.format(value);
    }
}