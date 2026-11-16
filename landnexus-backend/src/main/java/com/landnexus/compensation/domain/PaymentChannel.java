package com.landnexus.compensation.domain;

/** Classifies only the simulated payment path; this is not a connection to a government payment rail. */
public enum PaymentChannel {
    UNCLASSIFIED,
    PFMS_SIMULATED,
    DBT_SIMULATED,
    OTHER_SIMULATED
}
