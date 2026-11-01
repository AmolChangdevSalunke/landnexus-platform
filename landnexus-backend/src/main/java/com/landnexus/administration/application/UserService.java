package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.RoleResponse;
import com.landnexus.administration.api.dto.UserCreateRequest;
import com.landnexus.administration.api.dto.UserResponse;
import com.landnexus.administration.api.dto.UserRolesRequest;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import com.landnexus.shared.validation.PasswordPolicy;
import com.landnexus.shared.validation.TextNormalizer;
import java.time.Clock;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** User management. Role-escalation rules live here so they cannot be bypassed from the frontend. */
@Service
@Transactional(readOnly = true)
public class UserService {

    static final String SUPER_ADMIN = "SUPER_ADMIN";

    private final UserAccountRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public UserService(UserAccountRepository users, RoleRepository roles, RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.roles = roles;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    public PageResponse<UserResponse> list(int page, int size) {
        Page<UserAccount> result = users.findAll(PageParams.of(page, size, "username"));
        return PageResponse.from(result, UserResponse::from);
    }

    public UserResponse get(UUID id) {
        return UserResponse.from(find(id));
    }

    public List<RoleResponse> listRoles() {
        return roles.findAll().stream()
                .sorted(Comparator.comparing(Role::getCode))
                .map(RoleResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse create(UserCreateRequest request, CurrentActor actor) {
        String username = TextNormalizer.username(request.username());
        String email = TextNormalizer.email(request.email());
        PasswordPolicy.validate(request.password());
        Set<Role> assigned = resolveRoles(request.roles(), actor);
        if (users.existsByUsername(username)) {
            throw new DuplicateResourceException("Username already exists: " + username);
        }
        if (users.existsByEmail(email)) {
            throw new DuplicateResourceException("Email already exists: " + email);
        }
        UserAccount user = new UserAccount();
        user.setUsername(username);
        user.setEmail(email);
        user.setFullName(TextNormalizer.name(request.fullName()));
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEnabled(true);
        user.getRoles().addAll(assigned);
        user.setCreatedBy(actor.username());
        user.setUpdatedBy(actor.username());
        return UserResponse.from(users.saveAndFlush(user));
    }

    @Transactional
    public UserResponse setRoles(UUID id, UserRolesRequest request, CurrentActor actor) {
        UserAccount user = find(id);
        guardTarget(user, actor);
        Set<Role> assigned = resolveRoles(request.roles(), actor);
        user.getRoles().clear();
        user.getRoles().addAll(assigned);
        user.setUpdatedBy(actor.username());
        return UserResponse.from(users.saveAndFlush(user));
    }

    @Transactional
    public UserResponse setEnabled(UUID id, boolean enabled, CurrentActor actor) {
        UserAccount user = find(id);
        guardTarget(user, actor);
        if (!enabled && id.equals(actor.userId())) {
            throw new InvalidRequestException("You cannot disable your own account");
        }
        user.setEnabled(enabled);
        user.setUpdatedBy(actor.username());
        UserAccount saved = users.saveAndFlush(user);
        if (!enabled) {
            refreshTokens.revokeAllForUser(id, clock.instant());
        }
        return UserResponse.from(saved);
    }

    private Set<Role> resolveRoles(Set<String> requestedCodes, CurrentActor actor) {
        Set<Role> result = new HashSet<>();
        for (String requested : requestedCodes) {
            String code = requested.trim().toUpperCase(Locale.ROOT);
            Role role = roles.findByCode(code)
                    .orElseThrow(() -> new InvalidRequestException("Unknown role: " + code));
            if (SUPER_ADMIN.equals(code) && !actor.hasRole(SUPER_ADMIN)) {
                throw new AccessDeniedException("Only a SUPER_ADMIN can grant the SUPER_ADMIN role");
            }
            result.add(role);
        }
        return result;
    }

    private void guardTarget(UserAccount target, CurrentActor actor) {
        if (target.hasRole(SUPER_ADMIN) && !actor.hasRole(SUPER_ADMIN)) {
            throw new AccessDeniedException("Only a SUPER_ADMIN can modify a SUPER_ADMIN account");
        }
    }

    private UserAccount find(UUID id) {
        return users.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }
}
