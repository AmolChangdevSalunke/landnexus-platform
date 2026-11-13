package com.landnexus.projects.api.dto;

import jakarta.validation.constraints.Size;

/** The reason or remarks sent with an action. Mandatory for clarification requests, rejections and reopening. */
public record TransitionRequest(@Size(max = 1000) String reason) {
}
