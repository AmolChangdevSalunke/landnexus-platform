package com.landnexus.reporting.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class CsvWriterTest {

    private static List<Object> row(Object... values) {
        return Arrays.asList(values);
    }

    @Test
    void startsWithABom_usesCrLf_andLeavesNumbersAndNullsAlone() {
        String csv = CsvWriter.write(List.of("A", "B", "C"), List.of(row(1, "x", null)));

        assertThat(csv).isEqualTo("\uFEFFA,B,C\r\n1,x,\r\n");
    }

    @Test
    void quotesCommasQuotesAndNewlines() {
        String csv = CsvWriter.write(List.of("T"), List.of(row("a,b"), row("say \"hi\""), row("two\nlines")));

        assertThat(csv).contains("\"a,b\"").contains("\"say \"\"hi\"\"\"").contains("\"two\nlines\"");
    }

    @Test
    void textThatCouldRunAsAFormulaGetsAQuoteMark_butNumbersDoNot() {
        assertThat(CsvWriter.cell("=1+1")).isEqualTo("'=1+1");
        assertThat(CsvWriter.cell("+91 99999")).isEqualTo("'+91 99999");
        assertThat(CsvWriter.cell("-cmd")).isEqualTo("'-cmd");
        assertThat(CsvWriter.cell("@SUM(A1)")).isEqualTo("'@SUM(A1)");
        assertThat(CsvWriter.cell("\tx")).isEqualTo("'\tx");
        assertThat(CsvWriter.cell(new BigDecimal("-5.50"))).isEqualTo("-5.50");
        assertThat(CsvWriter.cell(-3L)).isEqualTo("-3");
        assertThat(CsvWriter.cell("normal")).isEqualTo("normal");
    }

    @Test
    void marathiTextIsKeptAsIs() {
        assertThat(CsvWriter.cell("औरंगाबाद जिल्हा")).isEqualTo("औरंगाबाद जिल्हा");
    }

    @Test
    void bigDecimalsAreWrittenWithoutScientificNotation() {
        assertThat(CsvWriter.cell(new BigDecimal("1E+3"))).isEqualTo("1000");
    }
}