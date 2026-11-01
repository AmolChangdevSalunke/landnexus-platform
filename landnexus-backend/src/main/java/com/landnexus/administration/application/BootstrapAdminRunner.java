package com.landnexus.administration.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Runs once at startup and delegates to BootstrapAdminService. */
@Component
public class BootstrapAdminRunner implements ApplicationRunner {

    private final BootstrapAdminService service;
    private final String username;
    private final String password;
    private final String email;

    public BootstrapAdminRunner(BootstrapAdminService service,
                                @Value("${landnexus.bootstrap.admin.username:}") String username,
                                @Value("${landnexus.bootstrap.admin.password:}") String password,
                                @Value("${landnexus.bootstrap.admin.email:}") String email) {
        this.service = service;
        this.username = username;
        this.password = password;
        this.email = email;
    }

    @Override
    public void run(ApplicationArguments args) {
        service.bootstrapIfNeeded(username, password, email);
    }
}
