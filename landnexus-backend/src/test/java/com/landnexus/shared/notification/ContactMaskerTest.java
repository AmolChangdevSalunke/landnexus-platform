package com.landnexus.shared.notification;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ContactMaskerTest {

    @Test
    void email_keepsTheDomainAndOnlyTheFirstAndLastLocalCharacters() {
        assertThat(ContactMasker.email("john.doe@example.com")).isEqualTo("j***e@example.com");
        assertThat(ContactMasker.email("a@example.com")).isEqualTo("a***@example.com");
        assertThat(ContactMasker.email("not-an-email")).isEqualTo("***");
        assertThat(ContactMasker.email(null)).isEqualTo("***");
    }

    @Test
    void phone_keepsOnlyTheLastFourDigits() {
        assertThat(ContactMasker.phone("+91 98765 43210")).isEqualTo("******3210");
        assertThat(ContactMasker.phone("1234")).isEqualTo("***");
        assertThat(ContactMasker.phone(null)).isEqualTo("***");
    }
}
