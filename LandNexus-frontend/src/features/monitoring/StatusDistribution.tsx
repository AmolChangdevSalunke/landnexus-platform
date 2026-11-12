import type { ReactNode } from 'react'
import { Card, CardHeader } from '../../components/ui/Card'
import { cn } from '../../utils/cn'
import { formatNumber } from '../../utils/format'
import type { CountEntry, Tone } from './labels'

const BARS: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-600',
  success: 'bg-success-600',
  warning: 'bg-warning-600',
  danger: 'bg-danger-600',
  teal: 'bg-teal-600',
}

/**
 * A status distribution drawn with CSS bars. Counts come from the API; the bar
 * length is only a proportion of the largest value in the same list.
 */
export function StatusDistribution({
  title,
  description,
  items,
  emptyLabel = 'No records yet.',
  action,
}: {
  title: string
  description?: string
  items: CountEntry[]
  emptyLabel?: string
  action?: ReactNode
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const max = items.reduce((largest, item) => Math.max(largest, item.value), 0)

  return (
    <Card className="p-5">
      <CardHeader title={title} description={description} action={action} />

      {items.length === 0 || total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <dl className="mt-4 space-y-3">
          {items.map((item) => {
            const width = max === 0 ? 0 : Math.round((item.value / max) * 100)
            return (
              <div key={item.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="truncate text-slate-700">{item.label}</dt>
                  <dd className="shrink-0 font-semibold tabular-nums text-navy-900">
                    {formatNumber(item.value)}
                  </dd>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-full rounded-full', BARS[item.tone])}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </dl>
      )}
    </Card>
  )
}
