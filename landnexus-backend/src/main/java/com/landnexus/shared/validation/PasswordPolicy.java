package com.landnexus.shared.validation;

import com.landnexus.shared.exception.InvalidRequestException;
import java.nio.charset.StandardCharsets;

/** Minimum password rules for new accounts. BCrypt only uses the first 72 bytes, so longer input is refused. */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 12;
    public static final int MAX_BYTES = 72;

    private PasswordPolicy() {
    }

    public static void validate(String password) {
        if (password == null || password.length() < MIN_LENGTH) {
            throw new InvalidRequestException("Password must be at least " + MIN_LENGTH + " characters long");
        }
        if (!fitsBcrypt(password)) {
            throw new InvalidRequestException("Password is too long (maximum " + MAX_BYTES + " bytes)");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new InvalidRequestException("Password must contain at least one letter and one digit");
        }
    }

    public static boolean fitsBcrypt(String password) {
        return password != null && password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }
}
