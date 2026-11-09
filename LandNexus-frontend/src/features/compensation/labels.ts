import type { BadgeVariant } from '../../components/ui/Badge'
import type {
  AssetCategory,
  ComponentType,
  EstimateStatus,
  Framework,
  PaymentAction,
  PaymentStatus,
  RateStatus,
  RrBenefitKind,
  RrCaseStatus,
  RuleSetStatus,
  ValuationAction,
  ValuationStatus,
} from '../../api/types'

export const RATE_STATUS_LABELS: Record<RateStatus, string> = {
  PENDING: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const RATE_STATUS_VARIANTS: Record<RateStatus, BadgeVariant> = {
  PENDING: 'neutral',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export const RULE_SET_STATUS_LABELS: Record<RuleSetStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  RETIRED: 'Retired',
}

export const RULE_SET_STATUS_VARIANTS: Record<RuleSetStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  APPROVED: 'success',
  RETIRED: 'warning',
}

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  LAND_VALUE: 'Land value',
  ASSET_VALUE: 'Asset value',
  PERCENT_OF: 'Percentage of earlier components',
  FIXED_PER_HECTARE: 'Fixed amount per hectare',
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  BUILDING: 'Building',
  TREE: 'Tree',
  WELL: 'Well',
  CROP: 'Crop',
  OTHER: 'Other',
}

export const VALUATION_STATUS_LABELS: Record<ValuationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUPERSEDED: 'Superseded',
}

export const VALUATION_STATUS_VARIANTS: Record<ValuationStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUPERSEDED: 'neutral',
}

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  NOT_ESTIMATED: 'Not estimated',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
}

export const ESTIMATE_STATUS_VARIANTS: Record<EstimateStatus, BadgeVariant> = {
  NOT_ESTIMATED: 'neutral',
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
}

export const VALUATION_ACTION_LABELS: Record<ValuationAction, string> = {
  SUBMIT: 'Submit for approval',
  RECALCULATE: 'Recalculate estimate',
  APPROVE: 'Approve estimate',
  REJECT: 'Reject estimate',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  INSTRUCTED: 'Instructed (simulated)',
  SENT: 'Sent (simulated)',
  CONFIRMED: 'Confirmed (simulated)',
  FAILED: 'Failed (simulated)',
}

export const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, BadgeVariant> = {
  INSTRUCTED: 'neutral',
  SENT: 'info',
  CONFIRMED: 'success',
  FAILED: 'danger',
}

export const PAYMENT_ACTION_LABELS: Record<PaymentAction, string> = {
  RELEASE: 'Release (simulated)',
  RETRY: 'Retry (simulated)',
  SIMULATE_CONFIRMED: 'Simulate confirmation',
  SIMULATE_FAILED: 'Simulate failure',
}

export const RR_BENEFIT_KIND_LABELS: Record<RrBenefitKind, string> = {
  ONE_TIME_CASH: 'One-time cash',
  MONTHLY_ALLOWANCE: 'Monthly allowance',
  HOUSING: 'Housing',
  EMPLOYMENT: 'Employment',
  OTHER: 'Other',
}

export const RR_CASE_STATUS_LABELS: Record<RrCaseStatus, string> = {
  IDENTIFIED: 'Identified',
  ASSESSED: 'Assessed',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
}

export const RR_CASE_STATUS_VARIANTS: Record<RrCaseStatus, BadgeVariant> = {
  IDENTIFIED: 'neutral',
  ASSESSED: 'info',
  APPROVED: 'success',
  COMPLETED: 'success',
}

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  LARR_2013: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013',
  NATIONAL_HIGHWAYS_ACT_1956: 'National Highways Act, 1956',
  RAILWAYS_ACT_1989: 'Railways Act, 1989',
  STATE_ACT: 'State land acquisition act',
  OTHER: 'Other framework',
}

export const FRAMEWORK_SHORT_LABELS: Record<Framework, string> = {
  LARR_2013: 'LARR 2013',
  NATIONAL_HIGHWAYS_ACT_1956: 'NH Act 1956',
  RAILWAYS_ACT_1989: 'Railways Act 1989',
  STATE_ACT: 'State act',
  OTHER: 'Other',
}

/** A place label: district wins over state, otherwise nationwide. */
export function ruleSetPlace(ruleSet: {
  districtId: string | null
  stateId: string | null
}): string {
  if (ruleSet.districtId) {
    return 'District specific'
  }
  if (ruleSet.stateId) {
    return 'State specific'
  }
  return 'Nationwide'
}
