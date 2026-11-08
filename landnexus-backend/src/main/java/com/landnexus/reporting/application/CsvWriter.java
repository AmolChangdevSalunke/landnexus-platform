package com.landnexus.reporting.application;

import java.math.BigDecimal;
import java.util.List;

/** RFC 4180 style CSV with a UTF-8 byte order mark (so Excel shows Marathi correctly) and protection against CSV injection. */
public final class CsvWriter {

    public static final String BOM = "\uFEFF";

    private CsvWriter() {
    }

    public static String write(List<String> headers, List<List<Object>> rows) {
        StringBuilder out = new StringBuilder(BOM);
        line(out, headers.stream().map(h -> (Object) h).toList());
        for (List<Object> row : rows) {
            line(out, row);
        }
        return out.toString();
    }

    private static void line(StringBuilder out, List<Object> cells) {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append(cell(cells.get(i)));
        }
        out.append("\r\n");
    }

    /** Text that starts with = + - @ tab or CR could run as a formula in a spreadsheet, so it gets a leading quote mark. */
    static String cell(Object value) {
        if (value == null) {
            return "";
        }
        String text = value instanceof BigDecimal b ? b.toPlainString() : String.valueOf(value);
        if (value instanceof CharSequence && !text.isEmpty()) {
            char first = text.charAt(0);
            if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
                text = "'" + text;
            }
        }
        if (text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
            text = "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }
}