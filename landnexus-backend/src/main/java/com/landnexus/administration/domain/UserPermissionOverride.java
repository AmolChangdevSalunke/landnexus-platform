package com.landnexus.administration.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_permission_overrides")
public class UserPermissionOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "permission_id", nullable = false, updatable = false)
    private Permission permission;

    @Column(name = "granted", nullable = false)
    private boolean granted;

    @Column(name = "changed_by", nullable = false, length = 100, updatable = false)
    private String changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected UserPermissionOverride() {
    }

    public UserPermissionOverride(UserAccount user, Permission permission, boolean granted, String changedBy) {
        this.user = user;
        this.permission = permission;
        this.granted = granted;
        this.changedBy = changedBy;
        this.changedAt = Instant.now();
    }

    public Permission getPermission() {
        return permission;
    }

    public boolean isGranted() {
        return granted;
    }
}
