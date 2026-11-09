import { Check } from 'lucide-react'
import type { CaseStatus } from '../../api/types'
import { cn } from '../../utils/cn'
import { CASE_STATUS_LABELS } from './labels'

const STAGES: CaseStatus[] = [
  'INITIATED',
  'SURVEY_IN_PROGRESS',
  'VERIFICATION_COMPLETE',
  'NOTIFICATION_ISSUED',
  'READY_FOR_AWARD',
  'AWARD_DECLARED',
  'POSSESSION_TAKEN',
  'CLOSED',
]

/**
 * The workflow shape is fixed by the backend. The tracker is descriptive only;
 * it never enables or disables a workflow action.
 */
export function StageTracker({ status }: { status: CaseStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
        This case was cancelled before the workflow could finish.
      </div>
    )
  }

  const currentIndex = STAGES.indexOf(status)

  return (
    <ol className="flex flex-wrap gap-2" aria-label="Acquisition stages">
      {STAGES.map((stage, index) => {
        const done = index < currentIndex
        const current = index === currentIndex
        return (
          <li
            key={stage}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              current
                ? 'border-blue-600 bg-blue-600 text-white'
                : done
                  ? 'border-success-100 bg-success-50 text-success-700'
                  : 'border-slate-200 bg-white text-slate-500',
            )}
          >
            {done ? (
              <Check aria-hidden="true" className="h-3 w-3" />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
                  current ? 'bg-white/20' : 'bg-slate-100 text-slate-600',
                )}
              >
                {index + 1}
              </span>
            )}
            {CASE_STATUS_LABELS[stage]}
          </li>
        )
      })}
    </ol>
  )
}
