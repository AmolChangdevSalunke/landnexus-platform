package com.landnexus.projects.domain;

/** The kinds of government infrastructure project. Linear projects must state a length in km. */
public enum ProjectType {
    NATIONAL_HIGHWAY(true),
    STATE_HIGHWAY(true),
    DISTRICT_ROAD(true),
    RURAL_ROAD(true),
    EXPRESSWAY(true),
    RAILWAY(true),
    DAM(false),
    IRRIGATION(false),
    SCHOOL(false),
    HOSPITAL(false),
    GOVERNMENT_BUILDING(false),
    OTHER_INFRASTRUCTURE(false);

    private final boolean linear;

    ProjectType(boolean linear) {
        this.linear = linear;
    }

    public boolean isLinear() {
        return linear;
    }
}
