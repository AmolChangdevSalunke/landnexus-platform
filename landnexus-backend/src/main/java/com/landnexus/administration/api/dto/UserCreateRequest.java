package com.landnexus.administration.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;

public record UserCreateRequest(
        @NotBlank @Size(min = 3, max = 60) @Pattern(regexp = "^[A-Za-z0-9._-]+$",
                message = "may contain only letters, digits, dot, underscore and hyphen") String username,
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Size(max = 150) String fullName,
        @NotBlank @Size(max = 128) String password,
        @NotEmpty Set<@NotBlank String> roles) {
}
