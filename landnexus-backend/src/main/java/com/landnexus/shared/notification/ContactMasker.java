package com.landnexus.shared.notification;

/** Masks contact data before it is stored, logged or audited. */
public final class ContactMasker {

    private ContactMasker() {
    }

    public static String email(String value) {
        if (value == null || value.isBlank()) {
            return "***";
        }
        String address = value.trim();
        int at = address.indexOf('@');
        if (at <= 0 || at == address.length() - 1) {
            return "***";
        }
        String local = address.substring(0, at);
        String domain = address.substring(at);
        if (local.length() == 1) {
            return local + "***" + domain;
        }
        return local.charAt(0) + "***" + local.charAt(local.length() - 1) + domain;
    }

    public static String phone(String value) {
        if (value == null || value.isBlank()) {
            return "***";
        }
        String digits = value.trim().replaceAll("[^0-9]", "");
        if (digits.length() <= 4) {
            return "***";
        }
        return "******" + digits.substring(digits.length() - 4);
    }
}
