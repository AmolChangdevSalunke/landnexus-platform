package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.CurrentUserResponse;
import com.landnexus.administration.api.dto.LoginRequest;
import com.landnexus.administration.api.dto.RefreshTokenRequest;
import com.landnexus.administration.api.dto.TokenResponse;
import com.landnexus.administration.application.AuthService;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** login / refresh / logout are public (the credential is in the body); /me needs a valid access token. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return service.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshTokenRequest request) {
        service.logout(request.refreshToken());
    }

    @GetMapping("/me")
    public CurrentUserResponse me(Authentication authentication) {
        return service.currentUser(CurrentActor.from(authentication).userId());
    }
}
