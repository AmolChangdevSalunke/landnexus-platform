package com.landnexus.shared.security;

import java.security.SecureRandom;
import java.util.Base64;

/** Generates unguessable refresh tokens (256 bits from a cryptographically secure random source). */
public final class TokenGenerator {

    private static final SecureRandom RANDOM = new SecureRandom();

    private TokenGenerator() {
    }

    public static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
