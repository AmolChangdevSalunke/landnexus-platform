import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getCase } from '../../api/acquisition'
import { getProject } from '../../api/projects'
import type { CaseResponse, ProjectResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDateTime, shortId } from '../../utils/format'
import { PERMISSION, PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { PaymentsTab } from '../compensation/PaymentsTab'
import { RrTab } from '../compensation/RrTab'
import { ValuationTab } from '../compensation/ValuationTab'
import { ActionBar } from './ActionBar'
import { AwardTab } from './AwardTab'
import { CaseStatusBadge } from './CaseStatusBadge'
import { FRAMEWORK_LABELS, FRAMEWORK_SHORT_LABELS } from './labels'
import { HistoryTab } from './HistoryTab'
import { NoticesTab } from './NoticesTab'
import { ObjectionsTab } from './ObjectionsTab'
import { PossessionTab } from './PossessionTab'
import { StageTracker } from './StageTracker'
import { SurveysTab } from './SurveysTab'
import { VerificationReportTab } from './VerificationReportTab'
import { VillagesParcelsTab } from './VillagesParcelsTab'

function CaseDetailsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function CaseDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const query = useApiQuery<CaseResponse | null>(
    () => (id ? getCase(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  if (query.isLoading) {
    return <CaseDetailsSkeleton />
  }

  if (query.error) {
    return (
      <>
        <PageHeader
          eyebrow="Module 4 · Land acquisition"
          title="Acquisition case"
          description="The case could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              query.error.status === 404
                ? 'Case not found'
                : query.error.status === 403
                  ? 'You do not have access'
                  : 'Could not load the acquisition case'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/acquisition" variant="outline">
              Back to cases
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  if (!query.data) {
    return (
      <>
        <PageHeader eyebrow="Module 4 · Land acquisition" title="Acquisition case" />
        <Card>
          <ErrorState
            title="Case not found"
            message="It may not exist, or it may be outside the districts you can see."
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/acquisition" variant="outline">
              Back to cases
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  return <CaseDetails acquisitionCase={query.data} onReload={query.reload} />
}

function CaseDetails({
  acquisitionCase,
  onReload,
}: {
  acquisitionCase: CaseResponse
  onReload: () => void
}) {
  const { can, canAny } = useAuth()
  const refs = useReferenceNames()
  const [reloadKey, setReloadKey] = useState(0)
  const [activeTab, setActiveTab] = useState('villages-parcels')
  const [awardFormOpen, setAwardFormOpen] = useState(false)
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)

  const projectQuery = useApiQuery<ProjectResponse | null>(
    () =>
      canReadProjects
        ? getProject(acquisitionCase.projectId)
        : Promise.resolve(null),
    [acquisitionCase.projectId, canReadProjects],
    canReadProjects,
  )

  function reloadCase() {
    setReloadKey((current) => current + 1)
    onReload()
  }

  function openAwardForm() {
    setActiveTab('award')
    setAwardFormOpen(true)
  }

  const tabs: TabItem[] = [
    {
      id: 'villages-parcels',
      label: 'Villages and parcels',
      content: (
        <VillagesParcelsTab
          acquisitionCase={acquisitionCase}
          reloadKey={reloadKey}
          onChanged={reloadCase}
        />
      ),
    },
    {
      id: 'surveys',
      label: 'Surveys',
      content: (
        <SurveysTab acquisitionCase={acquisitionCase} reloadKey={reloadKey} />
      ),
    },
    {
      id: 'verification',
      label: 'Verification report',
      content: (
        <VerificationReportTab
          acquisitionCase={acquisitionCase}
          reloadKey={reloadKey}
        />
      ),
    },
    {
      id: 'notices',
      label: 'Notices',
      content: (
        <NoticesTab acquisitionCase={acquisitionCase} reloadKey={reloadKey} />
      ),
    },
    {
      id: 'objections',
      label: 'Objections',
      content: (
        <ObjectionsTab acquisitionCase={acquisitionCase} reloadKey={reloadKey} />
      ),
    },
    {
      id: 'award',
      label: 'Award',
      content: (
        <AwardTab
          acquisitionCase={acquisitionCase}
          reloadKey={reloadKey}
          formOpen={awardFormOpen}
          onFormClose={() => setAwardFormOpen(false)}
          onChanged={reloadCase}
        />
      ),
    },
    {
      id: 'possession',
      label: 'Possession',
      content: (
        <PossessionTab
          acquisitionCase={acquisitionCase}
          reloadKey={reloadKey}
          onChanged={reloadCase}
        />
      ),
    },
    ...(can(PERMISSION.VALUATION_READ)
      ? [
          {
            id: 'valuation',
            label: 'Valuation',
            content: (
              <ValuationTab acquisitionCase={acquisitionCase} reloadKey={reloadKey} />
            ),
          },
        ]
      : []),
    ...(can(PERMISSION.PAYMENT_READ)
      ? [
          {
            id: 'payments',
            label: 'Payments',
            content: (
              <PaymentsTab acquisitionCase={acquisitionCase} reloadKey={reloadKey} />
            ),
          },
        ]
      : []),
    ...(can(PERMISSION.RR_READ)
      ? [
          {
            id: 'rr',
            label: 'R&R',
            content: (
              <RrTab acquisitionCase={acquisitionCase} reloadKey={reloadKey} />
            ),
          },
        ]
      : []),
    {
      id: 'history',
      label: 'History',
      content: (
        <HistoryTab acquisitionCase={acquisitionCase} reloadKey={reloadKey} />
      ),
    },
  ]

  const project = projectQuery.data

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Land acquisition"
        title={acquisitionCase.caseNumber}
        description={
          project
            ? project.title
            : `Project ${shortId(acquisitionCase.projectId)}`
        }
        actions={
          <LinkButton
            to="/acquisition"
            variant="outline"
            leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
          >
            Back to cases
          </LinkButton>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CaseStatusBadge status={acquisitionCase.status} />
          <Badge variant="neutral">
            {FRAMEWORK_SHORT_LABELS[acquisitionCase.framework]}
          </Badge>
          <span className="text-sm text-slate-600">
            {refs.districtName(acquisitionCase.districtId) ??
              `District ${shortId(acquisitionCase.districtId)}`}
            {' · '}
            {refs.stateName(acquisitionCase.stateId) ??
              `State ${shortId(acquisitionCase.stateId)}`}
          </span>
        </div>

        <div className="mt-4">
          <StageTracker status={acquisitionCase.status} />
        </div>

        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Project">
            {canReadProjects ? (
              <Link
                to={`/projects/${acquisitionCase.projectId}`}
                className="font-semibold text-blue-700 hover:underline"
              >
                {project ? `${project.code} · ${project.title}` : 'Project details'}
              </Link>
            ) : project ? (
              `${project.code} · ${project.title}`
            ) : (
              <span title={acquisitionCase.projectId}>
                Project {shortId(acquisitionCase.projectId)}
              </span>
            )}
          </Detail>
          <Detail label="Legal framework">
            <span title={FRAMEWORK_LABELS[acquisitionCase.framework]}>
              {FRAMEWORK_SHORT_LABELS[acquisitionCase.framework]}
            </span>
          </Detail>
          <Detail label="Created">{formatDateTime(acquisitionCase.createdAt)}</Detail>
          <Detail label="Last updated">
            {formatDateTime(acquisitionCase.updatedAt)}
          </Detail>
        </dl>

        {acquisitionCase.frameworkNote ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold">Framework note:</span>{' '}
            {acquisitionCase.frameworkNote}
          </p>
        ) : null}

        {acquisitionCase.description ? (
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {acquisitionCase.description}
          </p>
        ) : null}

        <p className="mt-3 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <span>Case ID</span>
          <span className="font-mono" title={acquisitionCase.id}>
            {shortId(acquisitionCase.id)}
          </span>
          <CopyButton value={acquisitionCase.id} label="case id" />
        </p>

        {projectQuery.error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-warning-700">
            The project title could not be loaded. {projectQuery.error.message}
          </p>
        ) : null}
      </Card>

      <div className="mb-4">
        <ActionBar
          acquisitionCase={acquisitionCase}
          onUpdated={reloadCase}
          onReload={reloadCase}
          onOpenAward={openAwardForm}
        />
      </div>

      <Card className="p-4">
        <CardHeader
          className="mb-4"
          title="Case record"
          description="Every section reads from the backend. Workflow buttons come only from the actions the backend allows now."
        />
        <Tabs
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
          label="Acquisition case sections"
        />
      </Card>
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-slate-800">{children}</dd>
    </div>
  )
}
