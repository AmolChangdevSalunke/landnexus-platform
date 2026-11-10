import type {
  BadgeVariant,
} from '../../components/ui/Badge'
import type {
  CaseAction,
  CaseStatus,
  Framework,
  NoticeType,
  ObjectionStatus,
  PossessionType,
  SurveyState,
  SurveyStatus,
} from '../../api/types'

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
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

export const CASE_STATUS_VARIANTS: Record<CaseStatus, BadgeVariant> = {
  INITIATED: 'neutral',
  SURVEY_IN_PROGRESS: 'info',
  VERIFICATION_COMPLETE: 'info',
  NOTIFICATION_ISSUED: 'warning',
  READY_FOR_AWARD: 'warning',
  AWARD_DECLARED: 'success',
  POSSESSION_TAKEN: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'danger',
}

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  LARR_2013: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013',
  NATIONAL_HIGHWAYS_ACT_1956: 'National Highways Act, 1956',
  RAILWAYS_ACT_1989: 'Railways Act, 1989',
  STATE_ACT: 'State land acquisition Act',
  OTHER: 'Other legal framework',
}

export const FRAMEWORK_SHORT_LABELS: Record<Framework, string> = {
  LARR_2013: 'LARR Act 2013',
  NATIONAL_HIGHWAYS_ACT_1956: 'National Highways Act 1956',
  RAILWAYS_ACT_1989: 'Railways Act 1989',
  STATE_ACT: 'State Act',
  OTHER: 'Other',
}

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  SUBMITTED: 'Awaiting verification',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
}

export const SURVEY_STATUS_VARIANTS: Record<SurveyStatus, BadgeVariant> = {
  SUBMITTED: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
}

export const SURVEY_STATE_LABELS: Record<SurveyState, string> = {
  VERIFIED: 'Verified',
  AWAITING_VERIFICATION: 'Awaiting verification',
  REJECTED_ONLY: 'Only rejected surveys',
  NOT_SURVEYED: 'Not surveyed',
}

export const SURVEY_STATE_VARIANTS: Record<SurveyState, BadgeVariant> = {
  VERIFIED: 'success',
  AWAITING_VERIFICATION: 'warning',
  REJECTED_ONLY: 'danger',
  NOT_SURVEYED: 'neutral',
}

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  PRELIMINARY_NOTIFICATION: 'Preliminary notification',
  FINAL_DECLARATION: 'Final declaration',
  AWARD_NOTICE: 'Award notice',
  POSSESSION_NOTICE: 'Possession notice',
  OTHER: 'Other notice',
}

export const NOTICE_TYPE_VARIANTS: Record<NoticeType, BadgeVariant> = {
  PRELIMINARY_NOTIFICATION: 'info',
  FINAL_DECLARATION: 'indigo',
  AWARD_NOTICE: 'success',
  POSSESSION_NOTICE: 'teal',
  OTHER: 'neutral',
}

/**
 * Notice types the backend accepts in the current stage. This only shapes the
 * form; the backend still rejects a type that is not allowed.
 */
export function recordableNoticeTypes(status: CaseStatus): NoticeType[] {
  switch (status) {
    case 'VERIFICATION_COMPLETE':
      return ['PRELIMINARY_NOTIFICATION', 'OTHER']
    case 'READY_FOR_AWARD':
      return ['FINAL_DECLARATION', 'OTHER']
    case 'AWARD_DECLARED':
      return ['AWARD_NOTICE', 'POSSESSION_NOTICE', 'OTHER']
    case 'POSSESSION_TAKEN':
      return ['POSSESSION_NOTICE', 'OTHER']
    case 'CLOSED':
    case 'CANCELLED':
      return []
    default:
      return ['OTHER']
  }
}

export const OBJECTION_STATUS_LABELS: Record<ObjectionStatus, string> = {
  OPEN: 'Open',
  ACCEPTED: 'Accepted',
  DISMISSED: 'Dismissed',
}

export const OBJECTION_STATUS_VARIANTS: Record<ObjectionStatus, BadgeVariant> = {
  OPEN: 'warning',
  ACCEPTED: 'success',
  DISMISSED: 'neutral',
}

export const POSSESSION_TYPE_LABELS: Record<PossessionType, string> = {
  PHYSICAL: 'Physical possession',
  DEEMED: 'Deemed possession',
}

export interface CaseActionMeta {
  label: string
  variant: 'primary' | 'outline' | 'danger'
  dialogTitle: string
  dialogDescription: string
  confirmLabel: string
  reason: 'none' | 'optional' | 'required'
  successMessage: string
}

export const CASE_ACTION_META: Record<CaseAction, CaseActionMeta> = {
  START_SURVEY: {
    label: 'Start survey',
    variant: 'primary',
    dialogTitle: 'Start surveying?',
    dialogDescription:
      'The assigned field officers can then record surveys for the identified parcels. At least one parcel must be identified first.',
    confirmLabel: 'Start survey',
    reason: 'none',
    successMessage: 'The survey stage has started.',
  },
  COMPLETE_VERIFICATION: {
    label: 'Complete verification',
    variant: 'primary',
    dialogTitle: 'Complete survey verification?',
    dialogDescription:
      'Every affected parcel must have a verified survey before this stage can move on.',
    confirmLabel: 'Complete verification',
    reason: 'none',
    successMessage: 'Survey verification is complete.',
  },
  ISSUE_NOTIFICATION: {
    label: 'Issue notification',
    variant: 'primary',
    dialogTitle: 'Issue the notification stage?',
    dialogDescription:
      'A preliminary notification with its objection deadline must already be recorded.',
    confirmLabel: 'Issue notification',
    reason: 'none',
    successMessage: 'The notification stage has started.',
  },
  CLOSE_OBJECTION_WINDOW: {
    label: 'Close objection window',
    variant: 'primary',
    dialogTitle: 'Close the objection window?',
    dialogDescription:
      'The objection deadline must have passed and every objection must be decided.',
    confirmLabel: 'Close objection window',
    reason: 'none',
    successMessage: 'The objection window is closed.',
  },
  DECLARE_AWARD: {
    label: 'Declare award',
    variant: 'primary',
    dialogTitle: 'Declare the award',
    dialogDescription:
      'Record the award number and date. The date cannot precede the end of the objection period. Compensation is not part of this module.',
    confirmLabel: 'Declare award',
    reason: 'none',
    successMessage: 'The award has been declared.',
  },
  COMPLETE_POSSESSION: {
    label: 'Complete possession',
    variant: 'primary',
    dialogTitle: 'Complete possession?',
    dialogDescription:
      'Every affected parcel must have a possession record before this stage can close.',
    confirmLabel: 'Complete possession',
    reason: 'none',
    successMessage: 'Possession is complete.',
  },
  CLOSE: {
    label: 'Close case',
    variant: 'primary',
    dialogTitle: 'Close the acquisition case?',
    dialogDescription:
      'Closing is final. You may add an optional reason for the record.',
    confirmLabel: 'Close case',
    reason: 'optional',
    successMessage: 'The case has been closed.',
  },
  CANCEL: {
    label: 'Cancel case',
    variant: 'danger',
    dialogTitle: 'Cancel the acquisition case?',
    dialogDescription:
      'Cancellation is final and requires a reason. Parcels are released for other cases.',
    confirmLabel: 'Cancel case',
    reason: 'required',
    successMessage: 'The case has been cancelled.',
  },
}

export function isCaseAction(value: string): value is CaseAction {
  return value in CASE_ACTION_META
}

export function noActionMessage(status: CaseStatus): string {
  switch (status) {
    case 'AWARD_DECLARED':
      return 'Record possession for every affected parcel, then complete possession. Cancellation is no longer possible after the award.'
    case 'POSSESSION_TAKEN':
      return 'The case can now be closed by a competent authority.'
    case 'CLOSED':
      return 'This case is closed. No further workflow actions are available.'
    case 'CANCELLED':
      return 'This case was cancelled. No further workflow actions are available.'
    default:
      return 'You do not have an available workflow action in this stage.'
  }
}

export function historyActionLabel(action: string): string {
  if (action === 'CREATE') {
    return 'Case created'
  }
  if (action in CASE_ACTION_META) {
    return CASE_ACTION_META[action as CaseAction].label
  }
  return action
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Rough bounding box used by the backend, not a border test. */
export function isInsideIndia(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 6.0 &&
    latitude <= 37.6 &&
    longitude >= 68.0 &&
    longitude <= 97.5
  )
}

/** Same rounding the backend uses for variance percentage. */
export function variancePercent(measured: number, recorded: number): number | null {
  if (!Number.isFinite(measured) || !Number.isFinite(recorded) || recorded <= 0) {
    return null
  }
  return Math.round(((measured - recorded) * 100 * 100) / recorded) / 100
}

export const VARIANCE_NOTE_THRESHOLD = 10

export function varianceWarning(measured: number, recorded: number): string | null {
  const variance = variancePercent(measured, recorded)
  if (variance === null || Math.abs(variance) <= VARIANCE_NOTE_THRESHOLD) {
    return null
  }
  return `The measured area differs from the recorded area by ${variance.toFixed(2)}%. Field notes are required above 10%.`
}

export const MAX_PHOTOS = 10
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png'])

export function photoExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Client-side checks only; the backend inspects the real file content. */
export function validatePhotoFile(file: File | null): string | null {
  if (!file) {
    return 'Choose a photo to upload.'
  }
  if (file.size <= 0) {
    return 'The file is empty.'
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'The photo is larger than 10 MB.'
  }
  if (!PHOTO_EXTENSIONS.has(photoExtension(file.name))) {
    return 'Only JPEG and PNG photos are accepted.'
  }
  return null
}

export function formatGps(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) {
    return '—'
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}
