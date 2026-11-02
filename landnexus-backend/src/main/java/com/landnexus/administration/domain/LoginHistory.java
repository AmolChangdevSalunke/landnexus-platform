package com.landnexus.administration.domain;

import com.landnexus.shared.security.ClientInfo;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One login attempt. The failure reason is for administrators only; the caller always sees the same generic message.
 * No foreign key to users on purpose: the history must outlive the account.
 */
@Entity
@Table(name = "login_history")
public class LoginHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", updatable = false)
    private UUID userId;

    @Column(name = "username_attempted", nullable = false, length = 60, updatable = false)
    private String usernameAttempted;

    @Column(name = "success", nullable = false, updatable = false)
    private boolean success;

    @Column(name = "failure_reason", length = 40, updatable = false)
    private String failureReason;

    @Column(name = "ip_address", length = 45, updatable = false)
    private String ipAddress;

    @Column(name = "user_agent", length = 255, updatable = false)
    private String userAgent;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected LoginHistory() {
    }

    private LoginHistory(UUID userId, String username, boolean success, String failureReason,
                         ClientInfo client, Instant occurredAt) {
        this.userId = userId;
        this.usernameAttempted = truncate(username, 60);
        this.success = success;
        this.failureReason = failureReason;
        this.ipAddress = client == null ? null : truncate(client.ipAddress(), 45);
        this.userAgent = client == null ? null : truncate(client.userAgent(), 255);
        this.occurredAt = occurredAt;
    }

    public static LoginHistory success(UUID userId, String username, ClientInfo client, Instant now) {
        return new LoginHistory(userId, username, true, null, client, now);
    }

    public static LoginHistory failure(UUID userId, String username, String reason, ClientInfo client, Instant now) {
        return new LoginHistory(userId, username, false, reason, client, now);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() > max ? value.substring(0, max) : value;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getUsernameAttempted() { return usernameAttempted; }
    public boolean isSuccess() { return success; }
    public String getFailureReason() { return failureReason; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
    public Instant getOccurredAt() { return occurredAt; }
}
