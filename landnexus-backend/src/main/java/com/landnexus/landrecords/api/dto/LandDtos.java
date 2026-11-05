package com.landnexus.landrecords.api.dto;

import com.landnexus.landrecords.domain.LandParcel;
import com.landnexus.landrecords.domain.LandTypes.LandClassification;
import com.landnexus.landrecords.domain.LandTypes.LandUse;
import com.landnexus.landrecords.domain.LandTypes.MutationType;
import com.landnexus.landrecords.domain.LandTypes.OwnerType;
import com.landnexus.landrecords.domain.LandTypes.OwnershipBasis;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.landrecords.domain.LandTypes.RevenueRecordType;
import com.landnexus.landrecords.domain.Landowner;
import com.landnexus.landrecords.domain.ParcelMutation;
import com.landnexus.landrecords.domain.RevenueRecord;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Request and response shapes of the land-records API. */
public final class LandDtos {

    private LandDtos() {
    }

    // ---------------------------------------------------------------- parcels
    /** At least one of Gat number or Survey number is required. Area is in hectares. */
    public record ParcelRequest(
            @NotNull UUID villageId,
            @Size(max = 30) String gatNumber,
            @Size(max = 30) String surveyNumber,
            @Size(max = 30) String subdivisionNumber,
            @NotNull @DecimalMin("0.0001") @Digits(integer = 8, fraction = 4) BigDecimal areaHa,
            @NotNull LandClassification classification,
            @NotNull LandUse landUse) {
    }

    public record ParcelResponse(UUID id, UUID stateId, UUID districtId, UUID talukaId, UUID villageId,
                                 String gatNumber, String surveyNumber, String subdivisionNumber, BigDecimal areaHa,
                                 LandClassification classification, LandUse landUse, ParcelStatus status,
                                 Instant createdAt, Instant updatedAt) {
        public static ParcelResponse from(LandParcel p) {
            return new ParcelResponse(p.getId(), p.getStateId(), p.getDistrictId(), p.getTalukaId(), p.getVillageId(),
                    p.getGatNumber(), p.getSurveyNumber(), p.getSubdivisionNumber(), p.getAreaHa(),
                    p.getClassification(), p.getLandUse(), p.getStatus(), p.getCreatedAt(), p.getUpdatedAt());
        }
    }

    // ---------------------------------------------------------------- landowners (sensitive)
    /** Sensitive personal data. Use synthetic "DEMO" names in demos. No Aadhaar or other government ID numbers. */
    public record LandownerRequest(
            @NotNull UUID districtId,
            @NotNull OwnerType ownerType,
            @NotBlank @Size(max = 200) String fullName,
            @Size(max = 200) String guardianName,
            @Size(max = 500) String address,
            @Pattern(regexp = "^[0-9+\\- ]{6,20}$", message = "must be 6 to 20 digits, spaces, plus or hyphen") String phone) {
    }

    public record LandownerResponse(UUID id, UUID districtId, OwnerType ownerType, String fullName,
                                    String guardianName, String address, String phone,
                                    Instant createdAt, Instant updatedAt) {
        public static LandownerResponse from(Landowner o) {
            return new LandownerResponse(o.getId(), o.getDistrictId(), o.getOwnerType(), o.getFullName(),
                    o.getGuardianName(), o.getAddress(), o.getPhone(), o.getCreatedAt(), o.getUpdatedAt());
        }
    }

    /** List view: no address or phone. */
    public record LandownerSummary(UUID id, UUID districtId, OwnerType ownerType, String fullName) {
        public static LandownerSummary from(Landowner o) {
            return new LandownerSummary(o.getId(), o.getDistrictId(), o.getOwnerType(), o.getFullName());
        }
    }

    // ---------------------------------------------------------------- ownership
    public record OwnershipRequest(
            @NotNull UUID landownerId,
            @NotNull @DecimalMin("0.01") @DecimalMax("100.00") @Digits(integer = 3, fraction = 2) BigDecimal sharePercent,
            @NotNull OwnershipBasis basis,
            @NotNull @PastOrPresent LocalDate fromDate,
            @Size(max = 500) String remarks) {
    }

    public record OwnershipEndRequest(@NotNull @PastOrPresent LocalDate endDate) {
    }

    /** ownerName and ownerType are null for callers without LANDOWNER_READ (personal data is masked). */
    public record OwnershipResponse(UUID id, UUID parcelId, UUID landownerId, String ownerName, OwnerType ownerType,
                                    BigDecimal sharePercent, OwnershipBasis basis, LocalDate fromDate,
                                    LocalDate toDate, boolean current, String remarks) {
    }

    // ---------------------------------------------------------------- mutations and 7/12, 8A
    public record MutationRequest(
            @NotBlank @Size(max = 30) String mutationNumber,
            @NotNull @PastOrPresent LocalDate mutationDate,
            @NotNull MutationType mutationType,
            @Size(max = 1000) String description) {
    }

    public record MutationResponse(UUID id, UUID parcelId, String mutationNumber, LocalDate mutationDate,
                                   MutationType mutationType, String description, String createdBy, Instant createdAt) {
        public static MutationResponse from(ParcelMutation m) {
            return new MutationResponse(m.getId(), m.getParcelId(), m.getMutationNumber(), m.getMutationDate(),
                    m.getMutationType(), m.getDescription(), m.getCreatedBy(), m.getCreatedAt());
        }
    }

    /** An 8A record needs the khata number. All text is typed in by an officer (no OCR). */
    public record RevenueRecordRequest(
            @NotNull RevenueRecordType recordType,
            @NotNull @PastOrPresent LocalDate extractDate,
            @Size(max = 30) String khataNumber,
            @NotBlank @Size(max = 2000) String particulars) {
    }

    public record RevenueRecordResponse(UUID id, UUID parcelId, RevenueRecordType recordType, LocalDate extractDate,
                                        String khataNumber, String particulars, String createdBy, Instant createdAt) {
        public static RevenueRecordResponse from(RevenueRecord r) {
            return new RevenueRecordResponse(r.getId(), r.getParcelId(), r.getRecordType(), r.getExtractDate(),
                    r.getKhataNumber(), r.getParticulars(), r.getCreatedBy(), r.getCreatedAt());
        }
    }
}