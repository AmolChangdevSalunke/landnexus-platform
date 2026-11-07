package com.landnexus.acquisition.application;

import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.NoticeType;
import com.landnexus.acquisition.domain.AcquisitionTypes.ObjectionStatus;
import com.landnexus.acquisition.domain.CaseWorkflow;
import com.landnexus.acquisition.domain.LegalNotice;
import com.landnexus.acquisition.infrastructure.CaseParcelRepository;
import com.landnexus.acquisition.infrastructure.LegalNoticeRepository;
import com.landnexus.acquisition.infrastructure.ObjectionRepository;
import com.landnexus.acquisition.infrastructure.PossessionRecordRepository;
import com.landnexus.shared.exception.InvalidRequestException;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

/** Conditions that must hold before a stage change, beyond "the action exists in this state". */
@Component
public class CaseGuards {

    private final LegalNoticeRepository notices;
    private final ObjectionRepository objections;
    private final PossessionRecordRepository possessions;
    private final CaseParcelRepository caseParcels;
    private final Clock clock;

    public CaseGuards(LegalNoticeRepository notices, ObjectionRepository objections,
                      PossessionRecordRepository possessions, CaseParcelRepository caseParcels, Clock clock) {
        this.notices = notices;
        this.objections = objections;
        this.possessions = possessions;
        this.caseParcels = caseParcels;
        this.clock = clock;
    }

    public void check(String action, AcquisitionCase c) {
        switch (action) {
            case CaseWorkflow.ISSUE_NOTIFICATION -> {
                if (preliminary(c).isEmpty()) {
                    throw new InvalidRequestException("Record the preliminary notification with its objection deadline first");
                }
            }
            case CaseWorkflow.CLOSE_OBJECTION_WINDOW -> {
                LegalNotice notice = preliminary(c).orElseThrow(
                        () -> new InvalidRequestException("There is no preliminary notification for this case"));
                LocalDate deadline = notice.getObjectionDeadline();
                if (!deadline.isBefore(LocalDate.now(clock))) {
                    throw new InvalidRequestException("The objection period is still open until " + deadline);
                }
                long open = objections.countByCaseIdAndStatus(c.getId(), ObjectionStatus.OPEN);
                if (open > 0) {
                    throw new InvalidRequestException(open + " objection(s) have not been reviewed yet");
                }
            }
            case CaseWorkflow.COMPLETE_POSSESSION -> {
                long parcels = caseParcels.countByCaseIdAndReleasedAtIsNull(c.getId());
                long taken = possessions.countByCaseId(c.getId());
                if (taken < parcels) {
                    throw new InvalidRequestException((parcels - taken) + " affected parcel(s) have no possession record yet");
                }
            }
            default -> {
            }
        }
    }

    private java.util.Optional<LegalNotice> preliminary(AcquisitionCase c) {
        return notices.findFirstByCaseIdAndNoticeTypeOrderByIssuedOnDesc(c.getId(), NoticeType.PRELIMINARY_NOTIFICATION);
    }
}