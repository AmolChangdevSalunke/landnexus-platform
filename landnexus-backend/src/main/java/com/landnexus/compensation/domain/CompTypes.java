package com.landnexus.compensation.domain;

public final class CompTypes {

    private CompTypes() {
    }

    public enum RateStatus { PENDING, APPROVED, REJECTED }

    public enum RuleSetStatus { DRAFT, APPROVED, RETIRED }

    /** LAND_VALUE = area x rate x multiplier; ASSET_VALUE = recorded assets; PERCENT_OF = % of earlier components; FIXED_PER_HECTARE = area x amount. */
    public enum ComponentType { LAND_VALUE, ASSET_VALUE, PERCENT_OF, FIXED_PER_HECTARE }

    public enum ValuationStatus { DRAFT, SUBMITTED, APPROVED, REJECTED, SUPERSEDED }

    public enum AssetCategory { BUILDING, TREE, WELL, CROP, OTHER }

    public enum PaymentStatus { INSTRUCTED, SENT, CONFIRMED, FAILED }

    public enum RrBenefitKind { ONE_TIME_CASH, MONTHLY_ALLOWANCE, HOUSING, EMPLOYMENT, OTHER }

    public enum RrCaseStatus { IDENTIFIED, ASSESSED, APPROVED, COMPLETED }

    public enum EntitlementStatus { PLANNED, DELIVERED }
}