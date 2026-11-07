package com.landnexus.compensation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.acquisition.application.AcquisitionLookupService;
import com.landnexus.acquisition.application.AcquisitionLookupService.CaseRef;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.compensation.api.dto.CompensationDtos.ValuationResponse;
import com.landnexus.compensation.domain.CompTypes.ValuationStatus;
import com.landnexus.compensation.domain.Valuation;
import com.landnexus.compensation.infrastructure.AssetRecordRepository;
import com.landnexus.compensation.infrastructure.ValuationLineRepository;
import com.landnexus.compensation.infrastructure.ValuationRepository;
import com.landnexus.landrecords.application.LandRecordsLookupService;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ValuationDecisionTest {

    @Mock private ValuationRepository valuations;
    @Mock private ValuationLineRepository lines;
    @Mock private AssetRecordRepository assets;
    @Mock private RateService rates;
    @Mock private RuleSetService ruleSets;
    @Mock private AcquisitionLookupService acquisition;
    @Mock private LandRecordsLookupService land;
    @Mock private AdministrationLookupService admin;
    @Mock private CompensationAccess access;
    @Mock private NotificationService notifications;
    @Mock private AuditService audit;

    private ValuationService service;
    private final UUID caseId = UUID.randomUUID();
    private final UUID valuationId = UUID.randomUUID();
    private final UUID preparerId = UUID.randomUUID();
    private final CurrentActor authority = new CurrentActor(UUID.randomUUID(), "authority", Set.of("COMPETENT_AUTHORITY"),
            Set.of("VALUATION_READ", "VALUATION_APPROVE"));

    @BeforeEach
    void setUp() {
        service = new ValuationService(valuations, lines, assets, rates, ruleSets, acquisition, land, admin, access,
                notifications, audit, Clock.fixed(Instant.parse("2026-11-07T10:00:00Z"), ZoneOffset.UTC));
        lenient().when(access.canView(any(), any())).thenReturn(true);
        lenient().when(acquisition.findCase(caseId)).thenReturn(Optional.of(
                new CaseRef(caseId, "ACQ-2026-000001", UUID.randomUUID(), UUID.randomUUID(), "LARR_2013", "AWARD_DECLARED")));
        lenient().when(valuations.saveAndFlush(any(Valuation.class))).thenAnswer(i -> i.getArgument(0));
    }

    private Valuation valuation(boolean submitted) {
        Valuation v = new Valuation(caseId, UUID.randomUUID(), UUID.randomUUID(), 1, new BigDecimal("1.5"), "AGRICULTURAL_DRY",
                UUID.randomUUID(), new BigDecimal("1000"), UUID.randomUUID(), "RS", 1, LocalDate.of(2026, 1, 1),
                BigDecimal.ZERO, new BigDecimal("1500.00"), preparerId, "scrutiny");
        ReflectionTestUtils.setField(v, "id", valuationId);
        if (submitted) {
            v.submit();
        }
        when(valuations.findById(valuationId)).thenReturn(Optional.of(v));
        return v;
    }

    @Test
    void thePreparerCannotApproveTheirOwnEstimate() {
        valuation(true);
        CurrentActor preparer = new CurrentActor(preparerId, "scrutiny", Set.of(), Set.of("VALUATION_READ", "VALUATION_APPROVE"));

        assertThatThrownBy(() -> service.approve(valuationId, null, preparer)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void anotherPersonApproves_andThePreparerIsNotified() {
        Valuation v = valuation(true);

        ValuationResponse r = service.approve(valuationId, "Checked", authority);

        assertThat(r.status()).isEqualTo(ValuationStatus.APPROVED);
        assertThat(v.getDecidedByUserId()).isEqualTo(authority.userId());
        verify(notifications).notify(eq(preparerId), anyString(), anyString(), anyString(), anyString(), eq(valuationId));
        verify(audit).record(eq("APPROVE"), eq("Valuation"), eq(valuationId), anyString());
    }

    @Test
    void aDraftCannotBeDecided_andRejectionNeedsRemarks() {
        valuation(false);

        assertThatThrownBy(() -> service.approve(valuationId, null, authority)).isInstanceOf(InvalidTransitionException.class);
        assertThatThrownBy(() -> service.reject(valuationId, " ", authority)).isInstanceOf(InvalidRequestException.class);
    }
}