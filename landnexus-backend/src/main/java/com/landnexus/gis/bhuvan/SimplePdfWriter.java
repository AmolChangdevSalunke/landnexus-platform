package com.landnexus.gis.bhuvan;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * A very small PDF writer for the analysis export: Helvetica text on A4 pages. It intentionally has no dependency on a
 * PDF library and never embeds the provider response as HTML. Non-Latin characters become '?' because the standard
 * PDF fonts only cover WinAnsi; the CSV export keeps the original UTF-8 text.
 */
final class SimplePdfWriter {

    private static final int LINES_PER_PAGE = 52;

    private SimplePdfWriter() {
    }

    static byte[] write(String title, List<String> sourceLines) {
        List<String> lines = new ArrayList<>();
        if (title != null && !title.isBlank()) {
            lines.add(title);
            lines.add("");
        }
        lines.addAll(sourceLines);
        List<List<String>> pages = new ArrayList<>();
        for (int start = 0; start < lines.size(); start += LINES_PER_PAGE) {
            pages.add(lines.subList(start, Math.min(lines.size(), start + LINES_PER_PAGE)));
        }
        if (pages.isEmpty()) {
            pages.add(List.of("No data"));
        }

        int objectCount = 3 + pages.size() * 2;
        String[] objects = new String[objectCount + 1];
        objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

        List<String> kids = new ArrayList<>();
        for (int i = 0; i < pages.size(); i++) {
            int pageObject = 4 + i * 2;
            int contentObject = pageObject + 1;
            kids.add(pageObject + " 0 R");
            objects[pageObject] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                    + "/Resources << /Font << /F1 3 0 R >> >> /Contents " + contentObject + " 0 R >>";
            String stream = content(pages.get(i));
            objects[contentObject] = "<< /Length " + stream.getBytes(StandardCharsets.ISO_8859_1).length + " >>\nstream\n"
                    + stream + "endstream";
        }
        objects[2] = "<< /Type /Pages /Kids [" + String.join(" ", kids) + "] /Count " + pages.size() + " >>";

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeAscii(out, "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
        int[] offsets = new int[objectCount + 1];
        for (int i = 1; i <= objectCount; i++) {
            offsets[i] = out.size();
            writeAscii(out, i + " 0 obj\n" + objects[i] + "\nendobj\n");
        }
        int xref = out.size();
        StringBuilder table = new StringBuilder("xref\n0 ").append(objectCount + 1).append("\n0000000000 65535 f \n");
        for (int i = 1; i <= objectCount; i++) {
            table.append(String.format("%010d 00000 n \n", offsets[i]));
        }
        table.append("trailer\n<< /Size ").append(objectCount + 1).append(" /Root 1 0 R >>\nstartxref\n")
                .append(xref).append("\n%%EOF\n");
        writeAscii(out, table.toString());
        return out.toByteArray();
    }

    private static String content(List<String> lines) {
        StringBuilder stream = new StringBuilder("BT\n/F1 10 Tf\n50 790 Td\n13.5 TL\n");
        for (String line : lines) {
            stream.append('(').append(escape(ascii(line))).append(") Tj\nT*\n");
        }
        stream.append("ET\n");
        return stream.toString();
    }

    private static String ascii(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder text = new StringBuilder();
        for (char c : value.toCharArray()) {
            text.append(c >= 32 && c <= 126 ? c : '?');
        }
        return text.length() > 110 ? text.substring(0, 110) : text.toString();
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }

    private static void writeAscii(ByteArrayOutputStream out, String value) {
        try {
            out.write(value.getBytes(StandardCharsets.ISO_8859_1));
        } catch (IOException e) {
            throw new IllegalStateException("Could not build the PDF", e);
        }
    }
}
