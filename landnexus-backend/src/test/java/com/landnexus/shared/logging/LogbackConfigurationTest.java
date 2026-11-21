package com.landnexus.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.PatternLayout;
import ch.qos.logback.classic.spi.LoggingEvent;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import javax.xml.parsers.DocumentBuilderFactory;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

/** Verifies the pattern and appenders actually configured, rather than a copy of them in the test. */
class LogbackConfigurationTest {

    private final LoggerContext context = new LoggerContext();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void consolePatternLooksLikeSpringBootAndIncludesRequestId() throws Exception {
        String xml = readConfiguration();
        Matcher matcher = Pattern.compile("name=\"CONSOLE_LOG_PATTERN\"\\s+value=\"([^\"]+)\"").matcher(xml);
        assertThat(matcher.find()).isTrue();
        String pattern = matcher.group(1);

        MDC.put(RequestLoggingFilter.REQUEST_ID, "req-42");
        Logger logger = context.getLogger("com.landnexus.administration.api.PropertyController");
        LoggingEvent event = new LoggingEvent(logger.getName(), logger, Level.INFO,
                "Property request received for id: 123", null, new Object[0]);
        event.setThreadName("nio-8080-exec-1");
        event.setMDCPropertyMap(Map.of(RequestLoggingFilter.REQUEST_ID, "req-42"));
        PatternLayout layout = new PatternLayout();
        layout.setContext(context);
        layout.setPattern(pattern);
        layout.start();

        String line = layout.doLayout(event);

        assertThat(line).containsPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}[+-]\\d{2}:\\d{2}");
        assertThat(line).contains("INFO").contains("--- [landnexus] [nio-8080-exec-1] [req-42]");
        assertThat(line).contains("c.l.a.api.PropertyController : Property request received for id: 123");
        layout.stop();
    }

    @Test
    void configurationIsWellFormedXml() throws Exception {
        try (InputStream in = LogbackConfigurationTest.class.getClassLoader()
                .getResourceAsStream("logback-spring.xml")) {
            assertThat(in).isNotNull();
            // Comments may not contain "--"; a parser catches that before the application starts.
            DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(in);
        }
    }

    @Test
    void productionProfileHasRotatingTextAndJsonFilesWithRetentionCaps() throws Exception {
        String xml = readConfiguration();

        assertThat(xml).contains("<springProfile name=\"prod\">");
        assertThat(xml).contains("RollingFileAppender");
        assertThat(xml).contains("SizeAndTimeBasedRollingPolicy");
        assertThat(xml).contains("landnexus.%d{yyyy-MM-dd}.%i.log.gz");
        assertThat(xml).contains("landnexus.%d{yyyy-MM-dd}.%i.jsonl.gz");
        assertThat(xml).contains("<maxHistory>30</maxHistory>");
        assertThat(xml).contains("<totalSizeCap>2GB</totalSizeCap>");
        assertThat(xml).contains("com.landnexus.shared.logging.StructuredJsonEncoder");
    }

    private static String readConfiguration() throws Exception {
        try (InputStream in = LogbackConfigurationTest.class.getClassLoader()
                .getResourceAsStream("logback-spring.xml")) {
            assertThat(in).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
