package com.landnexus.shared.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Optional contact details and channel preferences for one user. It is separate from the
 * users table so the existing administration API contract is unchanged. When no row exists,
 * EMAIL falls back to users.email and SMS stays disabled.
 */
@Entity
@Table(name = "notification_contacts")
public class NotificationContact {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "email", length = 150)
    private String email;

    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "email_enabled", nullable = false)
    private boolean emailEnabled = true;

    @Column(name = "sms_enabled", nullable = false)
    private boolean smsEnabled;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected NotificationContact() {
    }

    public NotificationContact(UUID userId, String email, String phone,
                               boolean emailEnabled, boolean smsEnabled, Instant updatedAt) {
        this.userId = userId;
        this.email = email;
        this.phone = phone;
        this.emailEnabled = emailEnabled;
        this.smsEnabled = smsEnabled;
        this.updatedAt = updatedAt;
    }

    public UUID getUserId() { return userId; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public boolean isEmailEnabled() { return emailEnabled; }
    public void setEmailEnabled(boolean emailEnabled) { this.emailEnabled = emailEnabled; }
    public boolean isSmsEnabled() { return smsEnabled; }
    public void setSmsEnabled(boolean smsEnabled) { this.smsEnabled = smsEnabled; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
