package com.landnexus.administration.api;

import com.landnexus.administration.application.PasswordService;
import com.landnexus.administration.application.PasswordService.IssuedCode;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Password endpoints. /auth/reset-password is public (see PublicEndpointsConfig); the other two need a token and a permission. */
@RestController
public class PasswordController {

    public record ChangePasswordRequest(@NotBlank @Size(max = 128) String currentPassword, @NotBlank @Size(max = 128) String newPassword) {
    }

    public record ResetPasswordRequest(@NotBlank @Size(max = 200) String code, @NotBlank @Size(max = 128) String newPassword) {
    }

    /** The code is shown only here, once: it cannot be read again. */
    public record IssuedCodeResponse(String username, String code, Instant expiresAt, String note) {
    }

    private final PasswordService service;

    public PasswordController(PasswordService service) {
        this.service = service;
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/api/v1/auth/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void change(@Valid @RequestBody ChangePasswordRequest request, Authentication authentication) {
        service.changePassword(CurrentActor.from(authentication), request.currentPassword(), request.newPassword());
    }

    @PostMapping("/api/v1/auth/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@Valid @RequestBody ResetPasswordRequest request) {
        service.reset(request.code(), request.newPassword());
    }

    @PreAuthorize("hasAuthority('PASSWORD_RESET_ISSUE')")
    @PostMapping("/api/v1/administration/users/{id}/password-reset")
    public IssuedCodeResponse issue(@PathVariable UUID id, Authentication authentication) {
        IssuedCode issued = service.issue(id, CurrentActor.from(authentication));
        return new IssuedCodeResponse(issued.username(), issued.code(), issued.expiresAt(),
                "Give this code to the user through a safe channel. It is shown only once and works for 60 minutes, one time.");
    }
}