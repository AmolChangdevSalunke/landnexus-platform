package com.landnexus.shared.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class NotificationTemplateServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-14T09:00:00Z");

    private static NotificationProperties properties(String linkBaseUrl) {
        return new NotificationProperties(linkBaseUrl,
                new NotificationProperties.Email("log", "no-reply@landnexus.local", "", "", 10),
                new NotificationProperties.Sms("log", "LANDNEXUS", "", "", 10),
                new NotificationProperties.Retry(3, 1000, 10_000));
    }

    @Test
    void proposalTemplate_addsSubjectIntroReferenceAndOptionalLink() {
        Notification notification = new Notification(UUID.randomUUID(), "PROPOSAL", "Proposal approved",
                "Your proposal was approved.", "Proposal", UUID.randomUUID(), NOW);
        NotificationTemplateService.Rendered rendered =
                new NotificationTemplateService(properties("http://localhost:5173")).render(notification);

        assertThat(rendered.subject()).isEqualTo("[LandNexus] Proposal approved");
        assertThat(rendered.emailBody())
                .contains("There is an update on a project proposal.")
                .contains("Your proposal was approved.")
                .contains("Reference: Proposal " + notification.getEntityId())
                .contains("http://localhost:5173/notifications")
                .contains("Please do not reply.");
        assertThat(rendered.smsBody()).startsWith("LandNexus: Proposal approved.").contains("approved");
    }

    @Test
    void unknownType_usesTheGenericIntro_andNoLinkWhenNotConfigured() {
        Notification notification = new Notification(UUID.randomUUID(), "OTHER", "Hello", "Message", null, null, NOW);
        NotificationTemplateService.Rendered rendered =
                new NotificationTemplateService(properties("")).render(notification);

        assertThat(rendered.emailBody())
                .contains("You have a new LandNexus notification.")
                .doesNotContain("Open LandNexus")
                .doesNotContain("Reference:");
    }

    @Test
    void smsBody_isBoundedTo320Characters() {
        Notification notification = new Notification(UUID.randomUUID(), "SLA", "Overdue",
                "x".repeat(1000), "SLA", UUID.randomUUID(), NOW);
        String sms = new NotificationTemplateService(properties("")).render(notification).smsBody();

        assertThat(sms).hasSize(320).endsWith("...");
    }

    @Test
    void acquisitionAndCompensationHaveTheirOwnIntros() {
        NotificationTemplateService service = new NotificationTemplateService(properties(""));
        assertThat(service.render(new Notification(UUID.randomUUID(), "ACQUISITION", "t", "m", null, null, NOW))
                .emailBody()).contains("land acquisition case");
        assertThat(service.render(new Notification(UUID.randomUUID(), "COMPENSATION", "t", "m", null, null, NOW))
                .emailBody()).contains("valuation or compensation");
        assertThat(service.render(new Notification(UUID.randomUUID(), "SLA", "t", "m", null, null, NOW))
                .emailBody()).contains("warning or breach");
    }
}
