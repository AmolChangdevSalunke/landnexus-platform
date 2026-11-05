package com.landnexus.projects.api.dto;

import jakarta.validation.constraints.Size;

/** The reason or remarks sent with an action. Mandatory for clarification requests and rejections. */
public record TransitionRequest(@Size(max = 1000) String reason) {
}
