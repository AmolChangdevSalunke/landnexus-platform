import type { ReactNode } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  phase,
  icon,
  plannedContent,
}: {
  eyebrow: string
  title: string
  description: string
  phase: string
  icon?: ReactNode
  plannedContent: string[]
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card>
        <EmptyState
          icon={icon}
          title={`This screen is being connected in ${phase}`}
          description="The route, permissions and layout are ready. Live data will appear here when the next phase is implemented."
        />
        <div className="border-t border-slate-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What this screen will contain
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            {plannedContent.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  )
}
