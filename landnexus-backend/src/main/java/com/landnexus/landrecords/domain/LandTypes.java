package com.landnexus.landrecords.domain;

/** The fixed vocabularies of the land-records module. */
public final class LandTypes {

    private LandTypes() {
    }

    public enum LandClassification {
        AGRICULTURAL_IRRIGATED, AGRICULTURAL_DRY, NON_AGRICULTURAL, FOREST, GOVERNMENT,
        RESIDENTIAL, COMMERCIAL, INDUSTRIAL, WASTE_LAND, OTHER
    }

    public enum LandUse { CULTIVATION, RESIDENTIAL, COMMERCIAL, INDUSTRIAL, ROAD, WATER_BODY, VACANT, OTHER }

    public enum OwnerType { INDIVIDUAL, GOVERNMENT, INSTITUTION }

    public enum OwnershipBasis { ORIGINAL, INHERITANCE, SALE, GIFT, PARTITION, COURT_ORDER, OTHER }

    public enum MutationType { SALE, INHERITANCE, GIFT, PARTITION, MORTGAGE, COURT_ORDER, OTHER }

    public enum RevenueRecordType { SEVEN_TWELVE, EIGHT_A }

    public enum ParcelStatus { ACTIVE, INACTIVE }

    public enum DocumentCategory {
        SEVEN_TWELVE_EXTRACT, EIGHT_A_EXTRACT, MUTATION_ENTRY, SALE_DEED, SURVEY_MAP, NOTICE, OTHER
    }

    public enum VerificationStatus { PENDING, VERIFIED, REJECTED }
}