import type { ReportCode, StatusAmount } from '../../api/types'

/**
 * Display labels and ordering for the values the monitoring API actually
 * returns. Nothing here invents a status: an unknown value falls back to a
 * readable form of the backend value.
 */

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_SCRUTINY: 'Under scrutiny',
  CLARIFICATION_REQUESTED: 'Clarification requested',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const PROPOSAL_STATUS_ORDER = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_SCRUTINY',
  'CLARIFICATION_REQUESTED',
  'RECOMMENDED',
  'APPROVED',
  'REJECTED',
]

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
}

export const PROJECT_STATUS_ORDER = ['ACTIVE', 'CLOSED']

export const CASE_STATUS_LABELS: Record<string, string> = {
  INITIATED: 'Initiated',
  SURVEY_IN_PROGRESS: 'Survey in progress',
  VERIFICATION_COMPLETE: 'Verification complete',
  NOTIFICATION_ISSUED: 'Notification issued',
  READY_FOR_AWARD: 'Ready for award',
  AWARD_DECLARED: 'Award declared',
  POSSESSION_TAKEN: 'Possession taken',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export const CASE_STATUS_ORDER = [
  'INITIATED',
  'SURVEY_IN_PROGRESS',
  'VERIFICATION_COMPLETE',
  'NOTIFICATION_ISSUED',
  'READY_FOR_AWARD',
  'AWARD_DECLARED',
  'POSSESSION_TAKEN',
  'CLOSED',
  'CANCELLED',
]

export const SURVEY_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Awaiting verification',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
}

export const SURVEY_STATUS_ORDER = ['SUBMITTED', 'VERIFIED', 'REJECTED']

export const OBJECTION_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ACCEPTED: 'Accepted',
  DISMISSED: 'Dismissed',
}

export const OBJECTION_STATUS_ORDER = ['OPEN', 'ACCEPTED', 'DISMISSED']

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUPERSEDED: 'Superseded',
}

export const ESTIMATE_STATUS_ORDER = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
]

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  INSTRUCTED: 'Instructed',
  SENT: 'Sent',
  CONFIRMED: 'Confirmed',
  FAILED: 'Failed',
}

export const PAYMENT_STATUS_ORDER = ['INSTRUCTED', 'SENT', 'CONFIRMED', 'FAILED']

export const RR_STATUS_LABELS: Record<string, string> = {
  IDENTIFIED: 'Identified',
  ASSESSED: 'Assessed',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
}

export const RR_STATUS_ORDER = ['IDENTIFIED', 'ASSESSED', 'APPROVED', 'COMPLETED']

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'teal'

const STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_SCRUTINY: 'info',
  CLARIFICATION_REQUESTED: 'warning',
  RECOMMENDED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  ACTIVE: 'success',
  CLOSED: 'neutral',
  INITIATED: 'neutral',
  SURVEY_IN_PROGRESS: 'info',
  VERIFICATION_COMPLETE: 'info',
  NOTIFICATION_ISSUED: 'warning',
  READY_FOR_AWARD: 'warning',
  AWARD_DECLARED: 'success',
  POSSESSION_TAKEN: 'success',
  CANCELLED: 'danger',
  VERIFIED: 'success',
  OPEN: 'warning',
  ACCEPTED: 'success',
  DISMISSED: 'neutral',
  SUPERSEDED: 'danger',
  INSTRUCTED: 'warning',
  SENT: 'info',
  CONFIRMED: 'success',
  FAILED: 'danger',
  IDENTIFIED: 'neutral',
  ASSESSED: 'info',
  COMPLETED: 'success',
}

/** A readable label for a backend status value, with a safe fallback. */
export function statusLabel(value: string): string {
  return (
    PROPOSAL_STATUS_LABELS[value] ??
    CASE_STATUS_LABELS[value] ??
    ESTIMATE_STATUS_LABELS[value] ??
    PAYMENT_STATUS_LABELS[value] ??
    RR_STATUS_LABELS[value] ??
    SURVEY_STATUS_LABELS[value] ??
    OBJECTION_STATUS_LABELS[value] ??
    PROJECT_STATUS_LABELS[value] ??
    prettify(value)
  )
}

export function prettify(value: string): string {
  const words = value.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function toneForStatus(value: string): Tone {
  return STATUS_TONES[value] ?? 'neutral'
}

export interface CountEntry {
  key: string
  label: string
  value: number
  tone: Tone
}

/**
 * Turns a backend status→count map into an ordered list. Statuses the backend
 * does not mention are still shown as zero so the pipeline never looks like it
 * is missing a stage.
 */
export function toCountEntries(
  counts: Record<string, number> | null | undefined,
  order: string[],
  labels: Record<string, string>,
): CountEntry[] {
  if (!counts) {
    return []
  }
  const known = new Set(order)
  const extra = Object.keys(counts)
    .filter((key) => !known.has(key))
    .sort()
  return [...order, ...extra].map((key) => ({
    key,
    label: labels[key] ?? prettify(key),
    value: counts[key] ?? 0,
    tone: toneForStatus(key),
  }))
}

export function sumStatusAmounts(items: StatusAmount[] | null | undefined): number {
  if (!items) {
    return 0
  }
  return items.reduce((total, item) => total + (Number.isFinite(item.amount) ? item.amount : 0), 0)
}

export function amountForStatuses(
  items: StatusAmount[] | null | undefined,
  statuses: string[],
): number {
  if (!items) {
    return 0
  }
  const wanted = new Set(statuses)
  return items.reduce(
    (total, item) =>
      wanted.has(item.status) && Number.isFinite(item.amount) ? total + item.amount : total,
    0,
  )
}

/** The API sends months as `YYYY-MM`; format them without a timezone shift. */
export function formatMonth(value: string): string {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return value
  }
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}

export const REPORT_STATUS_OPTIONS: Record<ReportCode, { value: string; label: string }[]> = {
  PROJECTS: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'CLOSED', label: 'Closed' },
  ],
  ACQUISITION_CASES: CASE_STATUS_ORDER.map((value) => ({
    value,
    label: CASE_STATUS_LABELS[value],
  })),
  COMPENSATION: ESTIMATE_STATUS_ORDER.map((value) => ({
    value,
    label: ESTIMATE_STATUS_LABELS[value],
  })),
}

/**
 * The NLAMS lifecycle, and the backend values that represent each stage.
 * A case status is the stage a case is currently in, not a cumulative count,
 * so the pipeline on the lifecycle page shows "currently at" numbers.
 */
export const LIFECYCLE_STAGES: {
  id: string
  label: string
  description: string
  proposalStatuses?: string[]
  caseStatuses?: string[]
}[] = [
  {
    id: 'proposal',
    label: 'Proposal',
    description: 'Submitted, under scrutiny or awaiting clarification',
    proposalStatuses: ['SUBMITTED', 'UNDER_SCRUTINY', 'CLARIFICATION_REQUESTED'],
  },
  {
    id: 'approval',
    label: 'Approval',
    description: 'Proposal approved and an acquisition case opened',
    proposalStatuses: ['APPROVED'],
    caseStatuses: ['INITIATED'],
  },
  {
    id: 'verification',
    label: 'Survey and verification',
    description: 'Survey in progress or verification complete',
    caseStatuses: ['SURVEY_IN_PROGRESS', 'VERIFICATION_COMPLETE'],
  },
  {
    id: 'notification',
    label: 'Notification',
    description: 'Notification issued, objection window running',
    caseStatuses: ['NOTIFICATION_ISSUED'],
  },
  {
    id: 'award',
    label: 'Award',
    description: 'Ready for award or award declared',
    caseStatuses: ['READY_FOR_AWARD', 'AWARD_DECLARED'],
  },
  {
    id: 'possession',
    label: 'Possession',
    description: 'Possession taken',
    caseStatuses: ['POSSESSION_TAKEN'],
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Case closed',
    caseStatuses: ['CLOSED'],
  },
]

/** Case stages in lifecycle order, for the pipeline visual. */
export const CASE_PIPELINE_STAGES = [
  { key: 'INITIATED', label: 'Initiated' },
  { key: 'SURVEY_IN_PROGRESS', label: 'Survey' },
  { key: 'VERIFICATION_COMPLETE', label: 'Verified' },
  { key: 'NOTIFICATION_ISSUED', label: 'Notification' },
  { key: 'READY_FOR_AWARD', label: 'Ready for award' },
  { key: 'AWARD_DECLARED', label: 'Award declared' },
  { key: 'POSSESSION_TAKEN', label: 'Possession' },
  { key: 'CLOSED', label: 'Closed' },
]
