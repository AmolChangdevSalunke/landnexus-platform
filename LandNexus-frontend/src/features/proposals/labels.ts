import type { ButtonVariant } from '../../components/ui/Button'
import type { BadgeVariant } from '../../components/ui/Badge'
import type {
  AssignmentStage,
  AssignmentStatus,
  ProjectType,
  ProposalAction,
  ProposalStatus,
} from '../../api/types'

export const PROJECT_TYPES: readonly ProjectType[] = [
  'NATIONAL_HIGHWAY',
  'STATE_HIGHWAY',
  'DISTRICT_ROAD',
  'RURAL_ROAD',
  'EXPRESSWAY',
  'RAILWAY',
  'DAM',
  'IRRIGATION',
  'SCHOOL',
  'HOSPITAL',
  'GOVERNMENT_BUILDING',
  'OTHER_INFRASTRUCTURE',
]

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  NATIONAL_HIGHWAY: 'National highway',
  STATE_HIGHWAY: 'State highway',
  DISTRICT_ROAD: 'District road',
  RURAL_ROAD: 'Rural road',
  EXPRESSWAY: 'Expressway',
  RAILWAY: 'Railway',
  DAM: 'Dam',
  IRRIGATION: 'Irrigation',
  SCHOOL: 'School',
  HOSPITAL: 'Hospital',
  GOVERNMENT_BUILDING: 'Government building',
  OTHER_INFRASTRUCTURE: 'Other infrastructure',
}

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value)
}

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_SCRUTINY: 'Under scrutiny',
  CLARIFICATION_REQUESTED: 'Clarification requested',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const PROPOSAL_STATUS_BADGES: Record<ProposalStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_SCRUTINY: 'indigo',
  CLARIFICATION_REQUESTED: 'warning',
  RECOMMENDED: 'teal',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export const PROPOSAL_STATUS_OPTIONS = Object.entries(PROPOSAL_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as ProposalStatus, label }),
)

/** History actions come from the backend as uppercase codes. */
const HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created draft',
  SUBMIT: 'Submitted for scrutiny',
  RESUBMIT: 'Resubmitted for scrutiny',
  START_SCRUTINY: 'Scrutiny started',
  REQUEST_CLARIFICATION: 'Clarification requested',
  RECOMMEND: 'Recommended for approval',
  APPROVE: 'Approved',
  REJECT_SCRUTINY: 'Rejected at scrutiny',
  REJECT: 'Rejected',
  REOPEN: 'Reopened for revision',
  UPDATE: 'Draft updated',
}

export function historyActionLabel(action: string): string {
  const label = HISTORY_ACTION_LABELS[action]
  if (label) {
    return label
  }
  const words = action.replaceAll('_', ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type ActionReasonMode = 'required' | 'optional' | 'none'

export interface ProposalActionMeta {
  label: string
  reason: ActionReasonMode
  variant: ButtonVariant
  dialogTitle: string
  dialogDescription: string
  confirmLabel: string
}

export const PROPOSAL_ACTION_META: Record<ProposalAction, ProposalActionMeta> = {
  SUBMIT: {
    label: 'Submit for scrutiny',
    reason: 'none',
    variant: 'primary',
    dialogTitle: 'Submit this proposal?',
    dialogDescription:
      'The proposal will go to the scrutiny officers for your district. You cannot edit it while it is under review.',
    confirmLabel: 'Submit',
  },
  RESUBMIT: {
    label: 'Resubmit',
    reason: 'none',
    variant: 'primary',
    dialogTitle: 'Resubmit this proposal?',
    dialogDescription:
      'The proposal will return to scrutiny. The clarification history is kept.',
    confirmLabel: 'Resubmit',
  },
  START_SCRUTINY: {
    label: 'Start scrutiny',
    reason: 'none',
    variant: 'primary',
    dialogTitle: 'Start scrutiny?',
    dialogDescription: 'The proposal will move to under scrutiny.',
    confirmLabel: 'Start scrutiny',
  },
  REQUEST_CLARIFICATION: {
    label: 'Request clarification',
    reason: 'required',
    variant: 'secondary',
    dialogTitle: 'Request clarification',
    dialogDescription:
      'Explain what the consultant must clarify. The reason is recorded in the proposal history.',
    confirmLabel: 'Request clarification',
  },
  RECOMMEND: {
    label: 'Recommend',
    reason: 'optional',
    variant: 'primary',
    dialogTitle: 'Recommend this proposal?',
    dialogDescription:
      'The proposal will go to a competent authority for a final decision. Remarks are optional.',
    confirmLabel: 'Recommend',
  },
  REJECT_SCRUTINY: {
    label: 'Reject',
    reason: 'required',
    variant: 'danger',
    dialogTitle: 'Reject this proposal?',
    dialogDescription:
      'The reason is recorded in the proposal history and the consultant is notified. The owner can reopen the proposal later with a new reason.',
    confirmLabel: 'Reject',
  },
  APPROVE: {
    label: 'Approve',
    reason: 'optional',
    variant: 'primary',
    dialogTitle: 'Approve this proposal?',
    dialogDescription:
      'Approval is final and creates a government project from this proposal. Remarks are optional.',
    confirmLabel: 'Approve and create project',
  },
  REJECT: {
    label: 'Reject',
    reason: 'required',
    variant: 'danger',
    dialogTitle: 'Reject this proposal?',
    dialogDescription:
      'The reason is recorded in the proposal history and the consultant is notified. The owner can reopen the proposal later with a new reason.',
    confirmLabel: 'Reject',
  },
  REOPEN: {
    label: 'Reopen for revision',
    reason: 'required',
    variant: 'secondary',
    dialogTitle: 'Reopen this rejected proposal?',
    dialogDescription:
      'The proposal returns to draft for editing. It keeps its number, earlier versions and full history; resubmitting creates a new version. No project or acquisition case is created.',
    confirmLabel: 'Reopen for revision',
  },
}

export function actionSuccessMessage(action: ProposalAction, projectCode: string | null): string {
  switch (action) {
    case 'SUBMIT':
      return 'Proposal submitted for scrutiny.'
    case 'RESUBMIT':
      return 'Proposal resubmitted for scrutiny.'
    case 'START_SCRUTINY':
      return 'Scrutiny started.'
    case 'REQUEST_CLARIFICATION':
      return 'Clarification requested from the consultant.'
    case 'RECOMMEND':
      return 'Proposal recommended for approval.'
    case 'REJECT_SCRUTINY':
      return 'Proposal rejected at scrutiny.'
    case 'APPROVE':
      return projectCode
        ? `Proposal approved. Project ${projectCode} was created and acquisition initiation started.`
        : 'Proposal approved. A project was created.'
    case 'REJECT':
      return 'Proposal rejected.'
    case 'REOPEN':
      return 'Proposal reopened for revision. It keeps its number and earlier versions.'
  }
}

export function noActionMessage(status: ProposalStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'This draft has no actions for you. Only the owner can submit it.'
    case 'SUBMITTED':
      return 'Waiting for scrutiny by an officer.'
    case 'UNDER_SCRUTINY':
      return 'The proposal is under scrutiny. No action is available to you right now.'
    case 'CLARIFICATION_REQUESTED':
      return 'Waiting for the consultant to answer the clarification and resubmit.'
    case 'RECOMMENDED':
      return 'Waiting for a competent authority to approve or reject the proposal.'
    case 'APPROVED':
      return 'This proposal is approved. It is final.'
    case 'REJECTED':
      return 'This proposal is rejected. Its owner can reopen it for revision with a reason.'
  }
}

export const ASSIGNMENT_STAGE_LABELS: Record<AssignmentStage, string> = {
  SCRUTINY: 'Scrutiny',
  DECISION: 'Decision',
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REASSIGNED: 'Reassigned',
}
