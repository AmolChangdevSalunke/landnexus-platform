import { Check, Circle, GitBranch } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ProposalStatus } from '../../api/types'
import { PROPOSAL_STATUS_LABELS } from './labels'

const MAIN_FLOW: ProposalStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_SCRUTINY',
  'RECOMMENDED',
  'APPROVED',
]

const BRANCH_STATUSES: ProposalStatus[] = ['CLARIFICATION_REQUESTED', 'REJECTED']

function currentMainIndex(status: ProposalStatus): number {
  return BRANCH_STATUSES.includes(status) ? -1 : MAIN_FLOW.indexOf(status)
}

function completedMainIndex(status: ProposalStatus): number {
  if (status === 'CLARIFICATION_REQUESTED' || status === 'REJECTED') {
    return MAIN_FLOW.indexOf('UNDER_SCRUTINY')
  }
  return MAIN_FLOW.indexOf(status) - 1
}

/**
 * Shows the workflow shape from section 5.8. The current status is highlighted
 * with text and a visual marker; colour is never the only information.
 */
export function StatusTimeline({ status }: { status: ProposalStatus }) {
  const currentIndex = currentMainIndex(status)
  const completedIndex = completedMainIndex(status)
  const isFinalApproved = status === 'APPROVED'

  return (
    <div className="space-y-4">
      <ol aria-label="Proposal status flow" className="flex flex-wrap items-center gap-2">
        {MAIN_FLOW.map((step, index) => {
          const isCurrent = index === currentIndex
          const isDone = index <= completedIndex || isFinalApproved
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                  isCurrent
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : isDone
                      ? 'border-success-100 bg-success-50 text-success-700'
                      : 'border-slate-200 bg-white text-slate-500',
                )}
              >
                {isDone ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <Circle aria-hidden="true" className="h-3 w-3" />
                )}
                {PROPOSAL_STATUS_LABELS[step]}
              </span>
              {index < MAIN_FLOW.length - 1 ? (
                <span aria-hidden="true" className="text-slate-300">
                  →
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <GitBranch aria-hidden="true" className="h-3.5 w-3.5" />
          Branch outcomes
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li
            className={cn(
              'flex flex-wrap items-center gap-2 rounded-md px-2 py-1',
              status === 'CLARIFICATION_REQUESTED'
                ? 'bg-warning-50 font-semibold text-warning-700'
                : 'text-slate-600',
            )}
          >
            <span className="font-medium">Clarification requested</span>
            <span aria-hidden="true" className="text-slate-400">
              →
            </span>
            <span>resubmission returns the proposal to Submitted</span>
            {status === 'CLARIFICATION_REQUESTED' ? (
              <span className="rounded bg-warning-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Current
              </span>
            ) : null}
          </li>
          <li
            className={cn(
              'flex flex-wrap items-center gap-2 rounded-md px-2 py-1',
              status === 'REJECTED'
                ? 'bg-danger-50 font-semibold text-danger-700'
                : 'text-slate-600',
            )}
          >
            <span className="font-medium">Rejected</span>
            <span aria-hidden="true" className="text-slate-400">
              →
            </span>
            <span>outcome from scrutiny or after recommendation; the owner may reopen it</span>
            {status === 'REJECTED' ? (
              <span className="rounded bg-danger-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Current
              </span>
            ) : null}
          </li>
        </ul>
      </div>
    </div>
  )
}
