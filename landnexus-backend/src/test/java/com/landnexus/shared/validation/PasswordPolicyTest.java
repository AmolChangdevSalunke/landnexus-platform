package com.landnexus.shared.validation;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.shared.exception.InvalidRequestException;
import org.junit.jupiter.api.Test;

class PasswordPolicyTest {

    @Test
    void strongPassword_isAccepted() {
        assertThatCode(() -> PasswordPolicy.validate("Correct-Horse-42")).doesNotThrowAnyException();
    }

    @Test
    void tooShort_isRejected() {
        assertThatThrownBy(() -> PasswordPolicy.validate("Short1"))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void withoutDigit_isRejected() {
        assertThatThrownBy(() -> PasswordPolicy.validate("OnlyLettersHere"))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void withoutLetter_isRejected() {
        assertThatThrownBy(() -> PasswordPolicy.validate("123456789012345"))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void moreThan72Bytes_isRejected() {
        assertThatThrownBy(() -> PasswordPolicy.validate("a1".repeat(40)))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void nullPassword_isRejected() {
        assertThatThrownBy(() -> PasswordPolicy.validate(null))
                .isInstanceOf(InvalidRequestException.class);
    }
}
