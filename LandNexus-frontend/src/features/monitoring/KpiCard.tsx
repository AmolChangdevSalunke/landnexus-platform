import type { ReactNode } from 'react'
import { Card } from '../../components/ui/Card'
import { cn } from '../../utils/cn'

export type KpiTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'teal'

const TONES: Record<KpiTone, string> = {
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  neutral: 'bg-slate-100 text-slate-600',
  teal: 'bg-teal-50 text-teal-700',
}

/** One headline number. The value is always formatted by the caller. */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'info',
  unavailable = false,
}: {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  tone?: KpiTone
  unavailable?: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p
            className={cn(
              'mt-2 text-2xl font-bold tabular-nums',
              unavailable ? 'text-slate-400' : 'text-navy-900',
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONES[tone])}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}
