import type {
  AwardResponse,
  BenefitTypeResponse,
  CompensationSummary,
  PaymentEventResponse,
  PaymentResponse,
  PaymentSummary,
  RateResponse,
  RrCaseResponse,
  RuleSetResponse,
  ValuationResponse,
} from '../../api/types'
import {
  CASE_ID,
  CASE_PARCEL_ID,
  PARCEL_ID,
  PROJECT_ID,
} from '../acquisition/testFixtures'

export const RATE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const RULE_SET_ID = 'cccccccc-dddd-4ccc-8ccc-cccccccccccc'
export const VALUATION_ID = 'dddddddd-eeee-4ddd-8ddd-dddddddddddd'
export const PAYMENT_ID = 'eeeeeeee-ffff-4eee-8eee-eeeeeeeeeeee'
export const LANDOWNER_ID = 'ffffffff-1111-4fff-8fff-ffffffffffff'
export const RR_CASE_ID = '99999999-aaaa-4999-8999-999999999999'
export const BENEFIT_ID = '88888888-bbbb-4888-8888-888888888888'
export const ENTITLEMENT_ID = '77777777-cccc-4777-8777-777777777777'

export const AWARD: AwardResponse = {
  id: '66666666-dddd-4666-8666-666666666666',
  caseId: CASE_ID,
  awardNumber: 'AWARD/2026/17',
  awardDate: '2026-01-10',
  remarks: null,
  declaredByUserId: '11111111-1111-1111-1111-111111111111',
  lines: [
    {
      caseParcelId: CASE_PARCEL_ID,
      parcelId: PARCEL_ID,
      awardedAreaHa: 1.25,
    },
  ],
}

export const RATE: RateResponse = {
  id: RATE_ID,
  villageId: '44444444-4444-4444-8444-444444444444',
  districtId: '22222222-2222-4222-8222-222222222222',
  classification: 'AGRICULTURAL_IRRIGATED',
  ratePerHa: 1250000,
  effectiveFrom: '2026-01-01',
  sourceNote: 'Notification 12/2026',
  status: 'APPROVED',
  createdByUserId: '11111111-1111-1111-1111-111111111111',
  approvedByUserId: '22222222-2222-4222-8222-222222222222',
  decidedAt: '2026-01-02T10:00:00Z',
  decisionRemarks: null,
}

export const RULE_SET: RuleSetResponse = {
  id: RULE_SET_ID,
  name: 'LARR 2013 base',
  version: 1,
  framework: 'LARR_2013',
  stateId: null,
  districtId: null,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  description: null,
  status: 'APPROVED',
  createdByUserId: '11111111-1111-1111-1111-111111111111',
  approvedByUserId: '22222222-2222-4222-8222-222222222222',
  approvedAt: '2026-01-02T10:00:00Z',
  retireReason: null,
  components: [
    {
      position: 1,
      code: 'LAND_BASE',
      name: 'Land value',
      type: 'LAND_VALUE',
      factor: 1,
      baseCodes: [],
    },
  ],
}

export const VALUATION: ValuationResponse = {
  id: VALUATION_ID,
  caseId: CASE_ID,
  caseParcelId: CASE_PARCEL_ID,
  parcelId: PARCEL_ID,
  versionNo: 1,
  awardedAreaHa: 1.25,
  classification: 'AGRICULTURAL_IRRIGATED',
  ratePerHa: 1250000,
  ruleSetName: RULE_SET.name,
  ruleSetVersion: 1,
  referenceDate: '2026-01-10',
  assetTotal: 50000,
  totalAmount: 1612500,
  status: 'APPROVED',
  preparedByUsername: 'scrutiny.one',
  decidedByUserId: '22222222-2222-4222-8222-222222222222',
  decidedAt: '2026-01-11T10:00:00Z',
  decisionRemarks: 'Checked against the approved rate.',
  createdAt: '2026-01-10T10:00:00Z',
  lines: [
    {
      position: 1,
      code: 'LAND_BASE',
      name: 'Land value',
      type: 'LAND_VALUE',
      basis: '1.25 ha × ₹1,250,000 per hectare',
      amount: 1562500,
    },
    {
      position: 2,
      code: 'ASSETS',
      name: 'Asset value',
      type: 'ASSET_VALUE',
      basis: 'Recorded assets on the parcel',
      amount: 50000,
    },
  ],
  availableActions: [],
}

export const COMPENSATION_SUMMARY: CompensationSummary = {
  caseId: CASE_ID,
  caseNumber: 'ACQ/2026/1',
  parcels: 1,
  approved: 1,
  submitted: 0,
  draft: 0,
  notEstimated: 0,
  approvedTotal: VALUATION.totalAmount,
  rows: [
    {
      caseParcelId: CASE_PARCEL_ID,
      parcelId: PARCEL_ID,
      awardedAreaHa: 1.25,
      estimateStatus: 'APPROVED',
      valuationId: VALUATION_ID,
      totalAmount: VALUATION.totalAmount,
    },
  ],
}

export const PAYMENT: PaymentResponse = {
  id: PAYMENT_ID,
  valuationId: VALUATION_ID,
  caseId: CASE_ID,
  caseParcelId: CASE_PARCEL_ID,
  landownerId: LANDOWNER_ID,
  sharePercent: 100,
  amount: VALUATION.totalAmount,
  status: 'INSTRUCTED',
  mode: 'SIMULATED',
  reference: null,
  failureReason: null,
  attemptCount: 0,
  releasedAt: null,
  confirmedAt: null,
  availableActions: ['RELEASE'],
}

export const PAYMENT_SUMMARY: PaymentSummary = {
  caseId: CASE_ID,
  mode: 'SIMULATED',
  payments: 1,
  totalAmount: PAYMENT.amount,
  instructedAmount: PAYMENT.amount,
  sentAmount: 0,
  confirmedAmount: 0,
  failedAmount: 0,
}

export const PAYMENT_EVENT: PaymentEventResponse = {
  id: '55555555-eeee-4555-8555-555555555555',
  fromStatus: null,
  toStatus: 'INSTRUCTED',
  event: 'INSTRUCTED',
  actorUsername: 'finance.one',
  detail: 'Simulated instruction created from the approved estimate.',
  occurredAt: '2026-01-12T10:00:00Z',
}

export const BENEFIT_TYPE: BenefitTypeResponse = {
  id: BENEFIT_ID,
  code: 'HOUSING_UNIT',
  name: 'Housing unit',
  kind: 'HOUSING',
  defaultAmount: null,
  defaultMonths: null,
  requiresDisplaced: true,
  requiresLivelihoodLost: false,
  active: true,
}

export const RR_CASE: RrCaseResponse = {
  id: RR_CASE_ID,
  caseId: CASE_ID,
  landownerId: LANDOWNER_ID,
  displaced: true,
  livelihoodLost: false,
  status: 'ASSESSED',
  notes: 'Family lost the house on the acquired parcel.',
  createdByUserId: '11111111-1111-1111-1111-111111111111',
  approvedByUserId: null,
  decidedAt: null,
  entitlements: [
    {
      id: ENTITLEMENT_ID,
      benefitCode: BENEFIT_TYPE.code,
      benefitName: BENEFIT_TYPE.name,
      kind: BENEFIT_TYPE.kind,
      amount: null,
      months: null,
      status: 'PLANNED',
      deliveredOn: null,
      deliveryRemarks: null,
    },
  ],
  availableActions: ['APPROVE'],
}

export const COMPENSATION_PROJECT_ID = PROJECT_ID
