import { Check, CircleDot, X } from 'lucide-react'
import type { ProposalAssignment, ProposalStatus } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { formatDateTime } from '../../utils/format'
import { ASSIGNMENT_STAGE_LABELS, ASSIGNMENT_STATUS_LABELS, PROPOSAL_STATUS_LABELS } from './labels'

interface Step {
  key: string
  label: string
  description: string
}

const STEPS: Step[] = [
  { key: 'DRAFT', label: 'Draft', description: 'Created by the consultant.' },
  { key: 'SUBMITTED', label: 'Submitted', description: 'Sent to the district scrutiny desk.' },
  { key: 'SCRUTINY', label: 'Scrutiny', description: 'Technical and DGOR validation by the assigned officer.' },
  { key: 'RECOMMENDED', label: 'Recommended', description: 'Scrutiny officer recommends a decision.' },
  { key: 'APPROVED', label: 'Approved', description: 'Competent authority decides; a project is created.' },
]

function currentIndex(status: ProposalStatus): number {
  switch (status) {
    case 'DRAFT':
      return 0
    case 'SUBMITTED':
      return 1
    case 'UNDER_SCRUTINY':
    case 'CLARIFICATION_REQUESTED':
      return 2
    case 'RECOMMENDED':
      return 3
    case 'APPROVED':
      return 4
    case 'REJECTED':
      return 2
  }
}

function activeStage(status: ProposalStatus): 'SCRUTINY' | 'DECISION' | null {
  switch (status) {
    case 'SUBMITTED':
    case 'UNDER_SCRUTINY':
    case 'CLARIFICATION_REQUESTED':
      return 'SCRUTINY'
    case 'RECOMMENDED':
      return 'DECISION'
    default:
      return null
  }
}

/**
 * The NLAMS proposal journey. Colour is always paired with a text state so the
 * stepper stays readable without colour. Assignment details come from the backend,
 * this component never works out who should be assigned.
 */
export function NlamsStageStepper({
  status,
  assignments = [],
}: {
  status: ProposalStatus
  assignments?: ProposalAssignment[]
}) {
  const index = currentIndex(status)
  const rejected = status === 'REJECTED'
  const stage = activeStage(status)
  const assignment = stage
    ? [...assignments].reverse().find((item) => item.stage === stage)
    : undefined

  return (
    <div className="space-y-4">
      <ol className="grid gap-2 sm:grid-cols-5">
        {STEPS.map((step, stepIndex) => {
          const complete = stepIndex < index || (stepIndex === index && status === 'APPROVED')
          const current = stepIndex === index && !complete && !rejected
          const rejectedHere = rejected && stepIndex === index
          const stateLabel = rejectedHere
            ? 'Rejected here'
            : complete
              ? 'Completed'
              : current
                ? 'Current step'
                : 'Not reached'
          return (
            <li
              key={step.key}
              className={[
                'rounded-lg border p-3',
                rejectedHere
                  ? 'border-danger-100 bg-danger-50'
                  : complete
                    ? 'border-success-100 bg-success-50'
                    : current
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={[
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    rejectedHere
                      ? 'bg-danger-600 text-white'
                      : complete
                        ? 'bg-success-600 text-white'
                        : current
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-600',
                  ].join(' ')}
                >
                  {rejectedHere ? <X className="h-3.5 w-3.5" /> : complete ? <Check className="h-3.5 w-3.5" /> : stepIndex + 1}
                </span>
                <span className="text-sm font-semibold text-navy-900">{step.label}</span>
              </div>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{stateLabel}</p>
              <p className="mt-1 hidden text-xs leading-5 text-slate-600 sm:block">{step.description}</p>
            </li>
          )
        })}
      </ol>

      {rejected ? (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          This proposal was rejected. The workflow ends here; the reason is recorded in the history below.
        </p>
      ) : null}

      {assignment ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <CircleDot aria-hidden="true" className="h-4 w-4 text-blue-700" />
            <p className="text-sm font-semibold text-navy-900">
              {ASSIGNMENT_STAGE_LABELS[assignment.stage]} assignment
            </p>
            <Badge variant={assignment.overdue ? 'danger' : assignment.status === 'COMPLETED' ? 'success' : 'info'}>
              {assignment.overdue ? 'Overdue' : ASSIGNMENT_STATUS_LABELS[assignment.status]}
            </Badge>
            {assignment.ruleNote ? <Badge variant="neutral">{assignment.ruleNote}</Badge> : null}
          </div>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Assigned to</dt>
              <dd className="mt-0.5 text-slate-700">
                {assignment.assignedUsername ?? assignment.assignedUserId}
                <span className="text-slate-500"> ({assignment.assignedBy === 'SYSTEM' ? 'automatic' : assignment.assignedBy})</span>
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Assigned</dt>
              <dd className="mt-0.5 text-slate-700">{formatDateTime(assignment.assignedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Due</dt>
              <dd className="mt-0.5 text-slate-700">
                {assignment.dueAt ? formatDateTime(assignment.dueAt) : 'No due date'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        Current status: <span className="font-semibold text-slate-700">{PROPOSAL_STATUS_LABELS[status]}</span>
      </p>
    </div>
  )
}
