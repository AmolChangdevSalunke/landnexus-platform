package com.landnexus.acquisition.application;

import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.AcquisitionFramework;
import com.landnexus.acquisition.domain.AcquisitionTypes.NoticeType;
import com.landnexus.acquisition.domain.CaseParcel;
import com.landnexus.acquisition.domain.LegalNotice;
import com.landnexus.acquisition.infrastructure.AcquisitionAwardRepository;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.AwardParcelRepository;
import com.landnexus.acquisition.infrastructure.CaseParcelRepository;
import com.landnexus.acquisition.infrastructure.LegalNoticeRepository;
import com.landnexus.acquisition.domain.CaseParcelOwner;
import com.landnexus.acquisition.infrastructure.CaseParcelOwnerRepository;
import java.util.Set;
import java.util.stream.Collectors;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The published, read-only API other modules use to ask about acquisition cases and their award lines. */
@Service
@Transactional(readOnly = true)
public class AcquisitionLookupService {

    public record CaseRef(UUID id, String caseNumber, UUID stateId, UUID districtId, String framework, String status) {
    }

    public record AwardLineRef(UUID caseParcelId, UUID parcelId, BigDecimal awardedAreaHa) {
    }

    private final AcquisitionCaseRepository cases;
    private final AcquisitionAwardRepository awards;
    private final AwardParcelRepository awardParcels;
    private final CaseParcelRepository caseParcels;
    private final LegalNoticeRepository notices;
    private final CaseParcelOwnerRepository caseParcelOwners;

    public AcquisitionLookupService(AcquisitionCaseRepository cases, AcquisitionAwardRepository awards,
                                    AwardParcelRepository awardParcels, CaseParcelRepository caseParcels,
                                    LegalNoticeRepository notices, CaseParcelOwnerRepository caseParcelOwners) {
        this.cases = cases;
        this.awards = awards;
        this.awardParcels = awardParcels;
        this.caseParcels = caseParcels;
        this.notices = notices;
        this.caseParcelOwners = caseParcelOwners;
    }

    public Optional<CaseRef> findCase(UUID id) {
        return cases.findById(id).map((AcquisitionCase c) -> new CaseRef(c.getId(), c.getCaseNumber(), c.getStateId(),
                c.getDistrictId(), c.getFramework().name(), c.getStatus().name()));
    }

    public List<AwardLineRef> awardLines(UUID caseId) {
        return awards.findByCaseId(caseId)
                .map(a -> awardParcels.findByAwardId(a.getId()).stream()
                        .map(l -> new AwardLineRef(l.getCaseParcelId(),
                                caseParcels.findById(l.getCaseParcelId()).map(CaseParcel::getParcelId).orElse(null),
                                l.getAwardedAreaHa()))
                        .toList())
                .orElse(List.of());
    }

    /** The date the valuation refers to by default: when the preliminary notification was issued. */
    public Optional<LocalDate> preliminaryNoticeDate(UUID caseId) {
        return notices.findFirstByCaseIdAndNoticeTypeOrderByIssuedOnDesc(caseId, NoticeType.PRELIMINARY_NOTIFICATION)
                .map(LegalNotice::getIssuedOn);
    }

    public boolean isActiveCaseParcel(UUID caseId, UUID caseParcelId) {
        return caseParcels.findById(caseParcelId)
                .filter(p -> p.getCaseId().equals(caseId) && p.getReleasedAt() == null).isPresent();
    }

    public List<String> frameworks() {
        return Arrays.stream(AcquisitionFramework.values()).map(Enum::name).toList();
    }

    public record OwnerShareRef(UUID landownerId, BigDecimal sharePercent) {
    }

    /** The owners and shares recorded when the parcel was identified for the case (ids only). */
    public List<OwnerShareRef> ownerSnapshot(UUID caseParcelId) {
        return caseParcelOwners.findByCaseParcelIdIn(List.of(caseParcelId)).stream()
                .map((CaseParcelOwner o) -> new OwnerShareRef(o.getLandownerId(), o.getSharePercent())).toList();
    }

    public Set<UUID> caseLandownerIds(UUID caseId) {
        List<UUID> ids = caseParcels.findByCaseIdAndReleasedAtIsNullOrderByIdentifiedAtAsc(caseId).stream()
                .map(CaseParcel::getId).toList();
        if (ids.isEmpty()) {
            return Set.of();
        }
        return caseParcelOwners.findByCaseParcelIdIn(ids).stream().map(CaseParcelOwner::getLandownerId)
                .collect(Collectors.toSet());
    }
}