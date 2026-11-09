import type {
  AcquisitionHistoryEntry,
  AwardResponse,
  CaseParcel,
  CaseResponse,
  NoticeResponse,
  ObjectionResponse,
  PossessionResponse,
  SurveyResponse,
  VerificationReport,
} from '../../api/types'
import { TEST_USER } from '../../test/handlers'

export function authWith(permissions: string[]) {
  return {
    user: { ...TEST_USER, permissions },
    accessToken: 'test-access-token',
    status: 'authenticated' as const,
    error: null,
  }
}

export const PROJECT_ID = '99999999-9999-4999-8999-999999999999'
export const STATE_ID = '11111111-1111-4111-8111-111111111111'
export const DISTRICT_ID = '22222222-2222-4222-8222-222222222222'
export const VILLAGE_ID = '44444444-4444-4444-8444-444444444444'
export const PARCEL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const CASE_PARCEL_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
export const CASE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
export const SURVEY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

export const CASE: CaseResponse = {
  id: CASE_ID,
  caseNumber: 'ACQ-2026-000001',
  projectId: PROJECT_ID,
  stateId: STATE_ID,
  districtId: DISTRICT_ID,
  framework: 'LARR_2013',
  frameworkNote: null,
  description: 'Acquire land for the approach road.',
  status: 'INITIATED',
  villageIds: [VILLAGE_ID],
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-02T10:00:00Z',
  availableActions: [],
}

export const CASE_PARCEL: CaseParcel = {
  id: CASE_PARCEL_ID,
  caseId: CASE_ID,
  parcelId: PARCEL_ID,
  villageId: VILLAGE_ID,
  areaToAcquireHa: 0.4,
  assignedSurveyorUserId: TEST_USER.id,
  surveyStatus: null,
  owners: [],
  identifiedAt: '2026-02-03T10:00:00Z',
}

export const SURVEY: SurveyResponse = {
  id: SURVEY_ID,
  caseId: CASE_ID,
  caseParcelId: CASE_PARCEL_ID,
  surveyorUsername: TEST_USER.username,
  surveyedOn: '2026-02-04',
  measuredAreaHa: 0.42,
  recordedAreaHa: 0.4,
  variancePercent: 5,
  gpsLatitude: 18.52,
  gpsLongitude: 73.85,
  fieldNotes: null,
  status: 'SUBMITTED',
  verifiedByUserId: null,
  verifiedAt: null,
  verificationRemarks: null,
  createdAt: '2026-02-04T10:00:00Z',
}

export const AWARD: AwardResponse = {
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  caseId: CASE_ID,
  awardNumber: 'AWARD/2026/17',
  awardDate: '2026-03-01',
  remarks: 'Recorded after the objection window closed.',
  declaredByUserId: 'abababab-abab-4bab-8bab-abababababab',
  lines: [
    {
      caseParcelId: CASE_PARCEL_ID,
      parcelId: PARCEL_ID,
      awardedAreaHa: 0.4,
    },
  ],
}

export const POSSESSION: PossessionResponse = {
  id: '12121212-1212-4212-8212-121212121212',
  caseId: CASE_ID,
  caseParcelId: CASE_PARCEL_ID,
  possessionDate: '2026-03-10',
  possessionType: 'PHYSICAL',
  remarks: 'Handed over in the presence of the village officer.',
  recordedByUserId: 'abababab-abab-4bab-8bab-abababababab',
}

export const NOTICE: NoticeResponse = {
  id: '34343434-3434-4434-8434-343434343434',
  caseId: CASE_ID,
  noticeType: 'PRELIMINARY_NOTIFICATION',
  referenceNumber: 'PN/2026/09',
  issuedOn: '2026-02-10',
  objectionDeadline: '2026-02-25',
  description: null,
  createdBy: 'abababab-abab-4bab-8bab-abababababab',
}

export const OBJECTION_MASKED: ObjectionResponse = {
  id: '56565656-5656-4656-8656-565656565656',
  caseId: CASE_ID,
  caseParcelId: CASE_PARCEL_ID,
  objectionNumber: 'OBJ/2026/02',
  receivedOn: '2026-02-12',
  grounds: 'The measurement misses the eastern strip.',
  objectorReference: null,
  status: 'OPEN',
  registeredByUserId: 'abababab-abab-4bab-8bab-abababababab',
  decidedByUserId: null,
  decidedAt: null,
  decisionRemarks: null,
}

export const HISTORY: AcquisitionHistoryEntry[] = [
  {
    id: '78787878-7878-4878-8878-787878787878',
    fromStatus: 'INITIATED',
    toStatus: 'SURVEY_IN_PROGRESS',
    action: 'START_SURVEY',
    actorUsername: 'officer.one',
    reason: null,
    occurredAt: '2026-02-05T10:00:00Z',
  },
  {
    id: '90909090-9090-4090-8090-909090909090',
    fromStatus: null,
    toStatus: 'INITIATED',
    action: 'CREATE',
    actorUsername: 'officer.one',
    reason: 'New acquisition case for the project.',
    occurredAt: '2026-02-01T10:00:00Z',
  },
]

export const REPORT: VerificationReport = {
  caseId: CASE_ID,
  caseNumber: CASE.caseNumber,
  status: 'SURVEY_IN_PROGRESS',
  totalParcels: 1,
  verified: 0,
  awaitingVerification: 1,
  rejectedOnly: 0,
  notSurveyed: 0,
  totalAreaToAcquireHa: 0.4,
  parcels: [
    {
      caseParcelId: CASE_PARCEL_ID,
      parcelId: PARCEL_ID,
      recordedAreaHa: 0.4,
      areaToAcquireHa: 0.4,
      surveyState: 'AWAITING_VERIFICATION',
      measuredAreaHa: 0.42,
      variancePercent: 5,
      gpsLatitude: 18.52,
      gpsLongitude: 73.85,
      surveyorUsername: TEST_USER.username,
      verifiedAt: null,
    },
  ],
}
