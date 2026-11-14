package com.landnexus.shared.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One external delivery of an in-app notification (transactional outbox row).
 *
 * <p>Only a masked destination is stored. The real e-mail address or phone number is resolved
 * again when the dispatcher sends the message, so the delivery table never becomes a second,
 * unmasked copy of personal contact data.
 */
@Entity
@Table(name = "notification_deliveries")
public class NotificationDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "notification_id", nullable = false, updatable = false)
    private UUID notificationId;

    @Column(name = "recipient_user_id", nullable = false, updatable = false)
    private UUID recipientUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 20, updatable = false)
    private NotificationChannel channel;

    @Column(name = "destination_masked", nullable = false, length = 200, updatable = false)
    private String destinationMasked;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private DeliveryStatus status;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "provider", length = 60)
    private String provider;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "dedupe_key", nullable = false, length = 255, updatable = false)
    private String dedupeKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected NotificationDelivery() {
    }

    public NotificationDelivery(UUID notificationId, UUID recipientUserId, NotificationChannel channel,
                                String destinationMasked, int maxAttempts, String dedupeKey, Instant now) {
        this.notificationId = notificationId;
        this.recipientUserId = recipientUserId;
        this.channel = channel;
        this.destinationMasked = destinationMasked;
        this.maxAttempts = Math.max(1, maxAttempts);
        this.dedupeKey = dedupeKey;
        this.status = DeliveryStatus.PENDING;
        this.nextAttemptAt = now;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Records a successful provider call. */
    public void markSent(Instant now, String providerName) {
        this.attempts++;
        this.status = DeliveryStatus.SENT;
        this.provider = providerName;
        this.lastAttemptAt = now;
        this.sentAt = now;
        this.nextAttemptAt = null;
        this.lastError = null;
        this.updatedAt = now;
    }

    /**
     * Records a failed attempt and schedules the next one, or gives up when maxAttempts is
     * reached. Never stores the raw destination or provider credentials in the error text.
     */
    public void markFailed(Instant now, String safeError, long baseBackoffMs, long maxBackoffMs) {
        this.attempts++;
        this.lastAttemptAt = now;
        this.lastError = truncate(safeError, 1000);
        if (this.attempts >= this.maxAttempts) {
            this.status = DeliveryStatus.FAILED;
            this.nextAttemptAt = null;
        } else {
            this.status = DeliveryStatus.RETRY;
            long factor = 1L << Math.min(this.attempts - 1, 20);
            long delay = Math.min(Math.max(baseBackoffMs, 1) * factor, Math.max(maxBackoffMs, baseBackoffMs));
            this.nextAttemptAt = now.plusMillis(delay);
        }
        this.updatedAt = now;
    }

    /** An administrator asked for another run. The attempt budget starts again. */
    public void requeue(Instant now) {
        this.status = DeliveryStatus.RETRY;
        this.attempts = 0;
        this.nextAttemptAt = now;
        this.lastAttemptAt = null;
        this.sentAt = null;
        this.lastError = null;
        this.updatedAt = now;
    }

    public boolean isDue(Instant now) {
        return (status == DeliveryStatus.PENDING || status == DeliveryStatus.RETRY)
                && nextAttemptAt != null && !nextAttemptAt.isAfter(now);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() > max ? value.substring(0, max) : value;
    }

    public UUID getId() { return id; }
    public UUID getNotificationId() { return notificationId; }
    public UUID getRecipientUserId() { return recipientUserId; }
    public NotificationChannel getChannel() { return channel; }
    public String getDestinationMasked() { return destinationMasked; }
    public DeliveryStatus getStatus() { return status; }
    public int getAttempts() { return attempts; }
    public int getMaxAttempts() { return maxAttempts; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public Instant getSentAt() { return sentAt; }
    public String getProvider() { return provider; }
    public String getLastError() { return lastError; }
    public String getDedupeKey() { return dedupeKey; }
    public Instant getCreatedAt() { return createdAt; }
}
