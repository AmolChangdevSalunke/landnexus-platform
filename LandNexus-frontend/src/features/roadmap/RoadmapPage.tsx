import { useParams } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { LinkButton } from '../../components/ui/LinkButton'
import { NotFoundPage } from '../shared/NotFoundPage'
import { ROADMAP_MODULES } from '../../app/roadmapModules'

export function RoadmapPage() {
  const { module } = useParams<{ module: string }>()
  const config = module ? ROADMAP_MODULES[module] : undefined

  if (!config) {
    return <NotFoundPage />
  }

  return (
    <>
      <PageHeader
        eyebrow="Roadmap"
        title={config.title}
        description={config.summary}
        actions={<Badge variant="neutral">Planned</Badge>}
      />

      <Card className="p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-700">
            <Construction aria-hidden="true" className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-navy-900">
              This capability is planned and not available yet
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              This roadmap screen deliberately shows no data, charts or counts. The
              implemented modules — proposals, projects, acquisition, compensation, land
              records, GIS, monitoring and notifications — remain available from My work.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Planned contents
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {config.contents.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <LinkButton to="/" variant="outline" className="mt-6">
          Back to My work
        </LinkButton>
      </Card>
    </>
  )
}
