import { Card, CardHeader } from '../../components/ui/Card'
import { cn } from '../../utils/cn'
import { formatNumber } from '../../utils/format'

export interface PipelineStage {
  key: string
  label: string
  value: number
  description?: string
}

/**
 * Cases currently sitting at each stage. This is deliberately not a cumulative
 * funnel: the backend exposes the current status of a case, not how many cases
 * have passed through a stage.
 */
export function StagePipeline({
  title,
  description,
  stages,
  emptyLabel = 'No records at any stage yet.',
}: {
  title: string
  description?: string
  stages: PipelineStage[]
  emptyLabel?: string
}) {
  const max = stages.reduce((largest, stage) => Math.max(largest, stage.value), 0)
  const total = stages.reduce((sum, stage) => sum + stage.value, 0)

  return (
    <Card className="mb-5 p-5">
      <CardHeader
        title={title}
        description={description}
        action={
          <span className="text-sm text-slate-500">
            <span className="font-semibold text-navy-900">{formatNumber(total)}</span> in pipeline
          </span>
        }
      />

      {total === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage, index) => {
            const width = max === 0 ? 0 : Math.round((stage.value / max) * 100)
            return (
              <li key={stage.key} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span className="mr-1 text-slate-400">{index + 1}.</span>
                    {stage.label}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-navy-900">
                    {formatNumber(stage.value)}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-200">
                  <div
                    className={cn('h-full rounded-full bg-blue-600')}
                    style={{ width: `${width}%` }}
                  />
                </div>
                {stage.description ? (
                  <p className="mt-2 text-xs text-slate-500">{stage.description}</p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
