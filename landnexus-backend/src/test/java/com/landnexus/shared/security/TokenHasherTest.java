package com.landnexus.shared.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TokenHasherTest {

    @Test
    void sha256_matchesKnownVector() {
        assertThat(TokenHasher.sha256("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void generatedTokens_areLongAndUnique() {
        String first = TokenGenerator.newToken();
        String second = TokenGenerator.newToken();
        assertThat(first).hasSizeGreaterThanOrEqualTo(43);
        assertThat(first).isNotEqualTo(second);
    }
}
