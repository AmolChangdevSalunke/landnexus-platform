import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Archive,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  FolderOpen,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { getCases } from '../../api/acquisition'
import { getDashboard } from '../../api/monitoring'
import { getProject, getProjects } from '../../api/projects'
import type { CaseResponse, ProjectResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION, PROPOSAL_READ_ANY } from '../../utils/permissions'
import { formatArea, formatDate, formatNumber, shortId } from '../../utils/format'
import { CaseStatusBadge } from '../acquisition/CaseStatusBadge'
import { useAuth } from '../auth/useAuth'
import { ProjectStatusBadge } from '../projects/ProjectStatusBadge'
import { PROJECT_TYPE_LABELS } from '../proposals/labels'
import { KpiCard, KpiGrid } from './KpiCard'
import { MonitoringFilters } from './MonitoringFilters'
import { MonitoringTabs } from './MonitoringTabs'
import { StatusDistribution } from './StatusDistribution'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  toCountEntries,
} from './labels'
import { useMonitoringScope } from './scope'

export function ProjectMonitoringPage() {
  const { can, canAny } = useAuth()
  const canDashboard = can(PERMISSION.DASHBOARD_READ)
  const canProjects = canAny(...PROPOSAL_READ_ANY)
  const canCases = can(PERMISSION.ACQUISITION_READ)
  const scope = useMonitoringScope()
  const [params, setParams] = useSearchParams()
  const selectedProjectId = params.get('project') ?? ''
  const [page, setPage] = useState(0)

  const dashboard = useApiQuery(
    () => getDashboard({ stateId: scope.stateId, districtId: scope.districtId }),
    [scope.stateId, scope.districtId],
    canDashboard,
  )

  const projects = useApiQuery(
    () => getProjects({ districtId: scope.districtId || undefined, page, size: 20 }),
    [scope.districtId, page],
    canProjects,
  )

  const selectedProject = useApiQuery(
    () => getProject(selectedProjectId),
    [selectedProjectId],
    canProjects && Boolean(selectedProjectId),
  )

  const cases = useApiQuery(
    () => getCases({ projectId: selectedProjectId, page: 0, size: 50 }),
    [selectedProjectId],
    canCases && Boolean(selectedProjectId),
  )

  function selectProject(projectId: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (projectId) {
          next.set('project', projectId)
        } else {
          next.delete('project')
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="NLAMS · Monitoring and MIS"
        title="Project monitoring"
        description="Project portfolio, status distribution and the acquisition cases opened against a project."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                dashboard.reload()
                projects.reload()
                selectedProject.reload()
                cases.reload()
              }}
              isLoading={dashboard.isLoading || projects.isLoading}
              leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <LinkButton to="/monitoring/reports" variant="secondary">
              Project report
            </LinkButton>
          </>
        }
      />

      <MonitoringTabs />
      <MonitoringFilters scope={scope} />

      {dashboard.isLoading && !dashboard.data ? (
        <Card className="p-5">
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : dashboard.error && !dashboard.data ? (
        <Card>
          <ErrorState message={dashboard.error.message} onRetry={dashboard.reload} />
        </Card>
      ) : dashboard.data ? (
        <>
          <KpiGrid>
            <KpiCard
              label="Total projects"
              value={formatNumber(dashboard.data.projects.total)}
              hint="Projects in the current scope"
              icon={<FolderKanban className="h-5 w-5" />}
            />
            <KpiCard
              label="Active projects"
              value={formatNumber(dashboard.data.projects.byStatus.ACTIVE ?? 0)}
              hint="Status ACTIVE"
              icon={<Layers className="h-5 w-5" />}
              tone="success"
            />
            <KpiCard
              label="Closed projects"
              value={formatNumber(dashboard.data.projects.byStatus.CLOSED ?? 0)}
              hint="Status CLOSED"
              icon={<Archive className="h-5 w-5" />}
              tone="neutral"
            />
            <KpiCard
              label="Estimated land"
              value={formatArea(dashboard.data.projects.estimatedLandAreaHa)}
              hint="Estimated land area of projects"
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="teal"
            />
          </KpiGrid>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <StatusDistribution
              title="Projects by status"
              description="The project entity has two statuses: ACTIVE and CLOSED."
              items={toCountEntries(
                dashboard.data.projects.byStatus,
                PROJECT_STATUS_ORDER,
                PROJECT_STATUS_LABELS,
              )}
            />
            <Card className="p-5">
              <h2 className="text-base font-semibold text-navy-900">How progress is shown</h2>
              <p className="mt-2 text-sm text-slate-600">
                This system does not store project milestones, deadlines or a percentage
                completion. Project monitoring therefore uses the status the backend records and
                the acquisition cases opened against each project. Any “delayed” or
                “percent complete” figure would be invented, so none is shown.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Pending work per project is visible as SLA items on the{' '}
                <Link className="font-medium text-blue-700 hover:underline" to="/monitoring/sla">
                  SLA and alerts
                </Link>{' '}
                screen.
              </p>
            </Card>
          </div>
        </>
      ) : null}

      {canProjects ? (
        <Card className="mb-5 p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-navy-900">Projects</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a project to see its acquisition cases. The project list API accepts a
              district filter only.
              {scope.stateId && !scope.districtId
                ? ' A state-only filter affects the figures above but not this list; choose a district to narrow it.'
                : ''}
            </p>
          </div>

          {projects.error ? (
            <ErrorState message={projects.error.message} onRetry={projects.reload} />
          ) : (
            <ProjectTable
              rows={projects.data?.content ?? []}
              isLoading={projects.isLoading}
              selectedProjectId={selectedProjectId}
              onSelect={selectProject}
              page={projects.data?.page ?? page}
              size={projects.data?.size ?? 20}
              totalElements={projects.data?.totalElements ?? 0}
              totalPages={projects.data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          )}
        </Card>
      ) : (
        <Alert variant="info" className="mb-5">
          The project list needs proposal read access. Aggregate project figures above are still
          available from the monitoring dashboard.
        </Alert>
      )}

      {selectedProjectId ? (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-navy-900">
                {selectedProject.data?.title ?? 'Selected project'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedProject.data
                  ? `${selectedProject.data.code} · ${PROJECT_TYPE_LABELS[selectedProject.data.projectType]}`
                  : shortId(selectedProjectId)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <LinkButton
                to={`/projects/${selectedProjectId}`}
                variant="outline"
                size="sm"
                leftIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}
              >
                Open project
              </LinkButton>
              <Button variant="ghost" size="sm" onClick={() => selectProject('')}>
                Clear
              </Button>
            </div>
          </div>

          {!canCases ? (
            <Alert variant="info">
              Case details need acquisition read access. The project itself is still available
              from the link above.
            </Alert>
          ) : cases.error ? (
            <ErrorState message={cases.error.message} onRetry={cases.reload} />
          ) : (
            <CaseTable rows={cases.data?.content ?? []} isLoading={cases.isLoading} />
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <FolderOpen aria-hidden="true" className="h-5 w-5 text-slate-400" />
            Select a project in the table to see the acquisition cases opened against it.
          </div>
        </Card>
      )}
    </div>
  )
}

function ProjectTable({
  rows,
  isLoading,
  selectedProjectId,
  onSelect,
  page,
  size,
  totalElements,
  totalPages,
  onPageChange,
}: {
  rows: ProjectResponse[]
  isLoading: boolean
  selectedProjectId: string
  onSelect: (projectId: string) => void
  page: number
  size: number
  totalElements: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const columns: TableColumn<ProjectResponse>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <Link
          to={`/projects/${row.id}`}
          className="font-medium text-blue-700 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.code}
        </Link>
      ),
    },
    { key: 'title', header: 'Title', render: (row) => row.title },
    {
      key: 'type',
      header: 'Type',
      render: (row) => PROJECT_TYPE_LABELS[row.projectType],
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ProjectStatusBadge status={row.status} />,
    },
    {
      key: 'area',
      header: 'Estimated land',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => formatArea(row.estimatedLandAreaHa),
    },
    { key: 'approved', header: 'Approved', render: (row) => formatDate(row.approvedAt) },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      emptyTitle="No projects"
      emptyDescription="No projects have been approved in this scope yet."
      caption="Projects in the current monitoring scope"
      onRowClick={(row) => onSelect(row.id)}
      rowSelected={(row) => row.id === selectedProjectId}
      page={page}
      size={size}
      totalElements={totalElements}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  )
}

function CaseTable({ rows, isLoading }: { rows: CaseResponse[]; isLoading: boolean }) {
  const columns: TableColumn<CaseResponse>[] = [
    {
      key: 'case',
      header: 'Case number',
      render: (row) => (
        <Link
          to={`/acquisition/${row.id}`}
          className="font-medium text-blue-700 hover:underline"
        >
          {row.caseNumber}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <CaseStatusBadge status={row.status} />,
    },
    { key: 'framework', header: 'Framework', render: (row) => row.framework },
    { key: 'opened', header: 'Opened', render: (row) => formatDate(row.createdAt) },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      emptyTitle="No acquisition cases"
      emptyDescription="No acquisition case has been opened for this project yet."
      caption="Acquisition cases for the selected project"
    />
  )
}
