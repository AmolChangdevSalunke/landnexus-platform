package com.landnexus.shared.security;

/** Where a request came from; stored with login history. */
public record ClientInfo(String ipAddress, String userAgent) {

    public static ClientInfo unknown() {
        return new ClientInfo(null, null);
    }
}
