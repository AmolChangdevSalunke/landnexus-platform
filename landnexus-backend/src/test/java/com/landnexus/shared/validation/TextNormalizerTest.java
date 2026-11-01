package com.landnexus.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TextNormalizerTest {

    @Test
    void code_isTrimmedAndUpperCased() {
        assertThat(TextNormalizer.code("  mh-01 ")).isEqualTo("MH-01");
    }

    @Test
    void name_isTrimmedAndWhitespaceCollapsed() {
        assertThat(TextNormalizer.name("  Chhatrapati   Sambhajinagar ")).isEqualTo("Chhatrapati Sambhajinagar");
    }

    @Test
    void nullInput_staysNull() {
        assertThat(TextNormalizer.code(null)).isNull();
        assertThat(TextNormalizer.name(null)).isNull();
    }
}
