package com.landnexus.shared.notification;

import org.springframework.stereotype.Service;

/**
 * Plain-text templates for external delivery. In-app notifications keep the exact title and
 * message that the workflow produced; the templates only add a subject, a short reference and
 * (optionally) the frontend link.
 */
@Service
public class NotificationTemplateService {

    private static final int SMS_MAX = 320;
    private static final String SUBJECT_PREFIX = "[LandNexus] ";

    private final String linkBaseUrl;

    public NotificationTemplateService(NotificationProperties properties) {
        this.linkBaseUrl = properties.linkBaseUrl();
    }

    public Rendered render(Notification notification) {
        String subject = SUBJECT_PREFIX + notification.getTitle();
        String email = emailBody(notification);
        String sms = truncate("LandNexus: " + notification.getTitle() + ". " + notification.getMessage(), SMS_MAX);
        return new Rendered(subject, email, sms);
    }

    private String emailBody(Notification notification) {
        StringBuilder body = new StringBuilder();
        body.append("Hello,\n\n")
                .append(intro(notification.getType())).append("\n\n")
                .append(notification.getMessage()).append("\n\n");

        if (notification.getEntityType() != null) {
            body.append("Reference: ").append(notification.getEntityType());
            if (notification.getEntityId() != null) {
                body.append(' ').append(notification.getEntityId());
            }
            body.append("\n\n");
        }
        if (!linkBaseUrl.isBlank()) {
            body.append("Open LandNexus: ").append(linkBaseUrl).append("/notifications\n\n");
        }
        body.append("This is an automated message from LandNexus. Please do not reply.");
        return body.toString();
    }

    private static String intro(String type) {
        return switch (type == null ? "" : type) {
            case "PROPOSAL" -> "There is an update on a project proposal.";
            case "ACQUISITION" -> "There is an update on a land acquisition case.";
            case "COMPENSATION" -> "There is an update on valuation or compensation.";
            case "SLA" -> "An SLA item has reached a warning or breach.";
            default -> "You have a new LandNexus notification.";
        };
    }

    private static String truncate(String value, int max) {
        if (value.length() <= max) {
            return value;
        }
        return value.substring(0, max - 3) + "...";
    }

    public record Rendered(String subject, String emailBody, String smsBody) {
    }
}
