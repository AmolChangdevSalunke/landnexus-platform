package com.landnexus.administration.application;

import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.validation.PasswordPolicy;
import com.landnexus.shared.validation.TextNormalizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the very first SUPER_ADMIN, only when the users table is completely empty and the
 * credentials were supplied through environment variables. There is no default password in the code.
 */
@Service
public class BootstrapAdminService {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminService.class);

    private final UserAccountRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    public BootstrapAdminService(UserAccountRepository users, RoleRepository roles,
                                 PasswordEncoder passwordEncoder, AuditService audit) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    /** @return true when an account was created */
    @Transactional
    public boolean bootstrapIfNeeded(String username, String password, String email) {
        if (users.count() > 0) {
            return false;
        }
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            log.warn("No users exist and LANDNEXUS_ADMIN_USERNAME / LANDNEXUS_ADMIN_PASSWORD are not set: "
                    + "no administrator account was created, so nobody can log in yet.");
            return false;
        }
        PasswordPolicy.validate(password);
        Role superAdmin = roles.findByCode(UserService.SUPER_ADMIN)
                .orElseThrow(() -> new IllegalStateException("SUPER_ADMIN role is missing: check Flyway migration V3"));

        UserAccount admin = new UserAccount();
        admin.setUsername(TextNormalizer.username(username));
        admin.setEmail(TextNormalizer.email(email == null || email.isBlank() ? "admin@landnexus.local" : email));
        admin.setFullName("System Administrator");
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setEnabled(true);
        admin.getRoles().add(superAdmin);
        admin.setCreatedBy("bootstrap");
        admin.setUpdatedBy("bootstrap");
        UserAccount saved = users.saveAndFlush(admin);
        audit.recordAs(null, "bootstrap", "BOOTSTRAP_ADMIN_CREATED", "UserAccount", saved.getId(),
                "username=" + saved.getUsername());
        log.info("Bootstrap SUPER_ADMIN account '{}' was created", saved.getUsername());
        return true;
    }
}
