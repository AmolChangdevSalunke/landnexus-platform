package com.landnexus.compensation.domain;

import com.landnexus.compensation.domain.CompTypes.PaymentStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Every step of a payment with actor and time. Append-only (database trigger). */
@Entity
@Table(name = "payment_events")
public class PaymentEvent {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "payment_id", nullable = false, updatable = false) private UUID paymentId;
    @Enumerated(EnumType.STRING) @Column(name = "from_status", length = 20, updatable = false) private PaymentStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(name = "to_status", nullable = false, length = 20, updatable = false) private PaymentStatus toStatus;
    @Column(name = "event", nullable = false, length = 30, updatable = false) private String event;
    @Column(name = "actor_user_id", updatable = false) private UUID actorUserId;
    @Column(name = "actor_username", nullable = false, length = 100, updatable = false) private String actorUsername;
    @Column(name = "detail", length = 300, updatable = false) private String detail;
    @Column(name = "occurred_at", nullable = false, updatable = false) private Instant occurredAt;

    protected PaymentEvent() { }

    public PaymentEvent(UUID paymentId, PaymentStatus from, PaymentStatus to, String event, UUID actorUserId,
                        String actorUsername, String detail, Instant occurredAt) {
        this.paymentId = paymentId;
        this.fromStatus = from;
        this.toStatus = to;
        this.event = event;
        this.actorUserId = actorUserId;
        this.actorUsername = actorUsername;
        this.detail = detail;
        this.occurredAt = occurredAt;
    }

    public UUID getId() { return id; }
    public PaymentStatus getFromStatus() { return fromStatus; }
    public PaymentStatus getToStatus() { return toStatus; }
    public String getEvent() { return event; }
    public String getActorUsername() { return actorUsername; }
    public String getDetail() { return detail; }
    public Instant getOccurredAt() { return occurredAt; }
}