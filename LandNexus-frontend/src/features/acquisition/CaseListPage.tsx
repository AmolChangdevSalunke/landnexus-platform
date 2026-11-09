import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, RotateCcw } from 'lucide-react'
import { getCases } from '../../api/acquisition'
import { getProjects } from '../../api/projects'
import type { CaseStatus, PageResponse, ProjectResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, shortId } from '../../utils/format'
import { PERMISSION, PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { CaseStatusBadge } from './CaseStatusBadge'
import {
  CASE_STATUS_LABELS,
  FRAMEWORK_SHORT_LABELS,
} from './labels'

const FILTER_ALL = ''
const STATUS_OPTIONS = Object.entries(CASE_STATUS_LABELS) as [CaseStatus, string][]

export function CaseListPage() {
  const { can, canAny } = useAuth()
  const refs = useReferenceNames()
  const canCreate = can(PERMISSION.ACQUISITION_MANAGE)
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)

  const [status, setStatus] = useState<CaseStatus | typeof FILTER_ALL>(FILTER_ALL)
  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [projectId, setProjectId] = useState(FILTER_ALL)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const query = useApiQuery(
    () =>
      getCases({
        status: status || undefined,
        districtId: districtId || undefined,
        projectId: projectId || undefined,
        page,
        size,
      }),
    [status, districtId, projectId, page, size],
  )

  const projectsQuery = useApiQuery<PageResponse<ProjectResponse> | null>(
    () => (canReadProjects ? getProjects({ size: 100 }) : Promise.resolve(null)),
    [canReadProjects],
  )

  const projects = (projectsQuery.data?.content ?? []).filter(
    (project) => project.status === 'ACTIVE' || project.id === projectId,
  )
  const projectById = new Map(projects.map((project) => [project.id, project]))

  const hasFilters = status !== FILTER_ALL || districtId !== FILTER_ALL || projectId !== FILTER_ALL
  const rows = query.data?.content ?? []

  function changeStatus(next: string) {
    setStatus(next as CaseStatus | typeof FILTER_ALL)
    setPage(0)
  }

  function changeDistrict(next: string) {
    setDistrictId(next)
    setPage(0)
  }

  function changeProject(next: string) {
    setProjectId(next)
    setPage(0)
  }

  function clearFilters() {
    setStatus(FILTER_ALL)
    setDistrictId(FILTER_ALL)
    setProjectId(FILTER_ALL)
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === districtId,
  )
  const districtFilterDisabled = !refs.enabled || refs.isLoading || refs.error !== null

  const columns: TableColumn<(typeof rows)[number]>[] = [
    {
      key: 'case',
      header: 'Case',
      render: (acquisitionCase) => {
        const project = projectById.get(acquisitionCase.projectId)
        return (
          <div className="min-w-56">
            <Link
              to={`/acquisition/${acquisitionCase.id}`}
              className="font-mono font-semibold text-navy-900 hover:text-blue-700"
            >
              {acquisitionCase.caseNumber}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">
              {project ? project.title : `Project ${shortId(acquisitionCase.projectId)}`}
            </p>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (acquisitionCase) => <CaseStatusBadge status={acquisitionCase.status} />,
    },
    {
      key: 'district',
      header: 'District',
      render: (acquisitionCase) => (
        <span title={acquisitionCase.districtId}>
          {refs.districtName(acquisitionCase.districtId) ?? shortId(acquisitionCase.districtId)}
        </span>
      ),
    },
    {
      key: 'framework',
      header: 'Framework',
      render: (acquisitionCase) => (
        <Badge variant="neutral">{FRAMEWORK_SHORT_LABELS[acquisitionCase.framework]}</Badge>
      ),
    },
    {
      key: 'parcels',
      header: 'Villages',
      render: (acquisitionCase) => (
        <span className="whitespace-nowrap text-slate-700">
          {acquisitionCase.villageIds.length}{' '}
          {acquisitionCase.villageIds.length === 1 ? 'village' : 'villages'}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (acquisitionCase) => (
        <span className="whitespace-nowrap" title={acquisitionCase.updatedAt}>
          {formatDate(acquisitionCase.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (acquisitionCase) => (
        <LinkButton to={`/acquisition/${acquisitionCase.id}`} variant="outline" size="sm">
          View
        </LinkButton>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Land acquisition"
        title="Acquisition cases"
        description="Cases you can see, based on your role and geographic scope. The backend decides what is visible."
        actions={
          canCreate ? (
            <LinkButton
              to="/acquisition/new"
              leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
            >
              New case
            </LinkButton>
          ) : null
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Select
            label="Status"
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
          >
            <option value={FILTER_ALL}>All statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            label="District"
            value={districtId}
            onChange={(event) => changeDistrict(event.target.value)}
            disabled={districtFilterDisabled}
            hint={
              districtFilterDisabled
                ? 'District names are not available right now.'
                : 'Only districts in your scope are listed.'
            }
          >
            <option value={FILTER_ALL}>All districts</option>
            {districtOptions.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </Select>

          <Select
            label="Project"
            value={projectId}
            onChange={(event) => changeProject(event.target.value)}
            disabled={!canReadProjects || projectsQuery.isLoading}
            hint={
              canReadProjects
                ? 'Approved projects visible to you.'
                : 'Project data needs proposal read access.'
            }
          >
            <option value={FILTER_ALL}>All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.title}
              </option>
            ))}
          </Select>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {hasFilters ? (
              <Button
                variant="outline"
                onClick={clearFilters}
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              >
                Clear filters
              </Button>
            ) : null}
            <Button variant="outline" onClick={query.reload} disabled={query.isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {query.data ? (
          <p className="mt-3 text-xs text-slate-500">
            {query.data.totalElements}{' '}
            {query.data.totalElements === 1 ? 'case' : 'cases'}
            {hasFilters ? ' match your filters' : ' visible to you'}
          </p>
        ) : null}

        {projectsQuery.error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-warning-700">
            Project names could not be loaded. ({projectsQuery.error.message})
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={query.error.status === 403 ? 'You do not have access' : 'Could not load cases'}
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(acquisitionCase) => acquisitionCase.id}
          isLoading={query.isLoading}
          caption="Acquisition cases visible to you"
          emptyTitle={hasFilters ? 'No cases match these filters' : 'No acquisition cases yet'}
          emptyDescription={
            hasFilters
              ? 'Try another status, district or project, or clear the filters.'
              : canCreate
                ? 'Create a case for an approved project in your scope.'
                : 'Cases appear here when they are started for your district.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canCreate ? (
              <LinkButton to="/acquisition/new">New case</LinkButton>
            ) : undefined
          }
          page={query.data?.page ?? page}
          size={query.data?.size ?? size}
          totalElements={query.data?.totalElements ?? 0}
          totalPages={query.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={changeSize}
        />
      )}

      {query.data && query.data.totalElements > 0 ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Badge variant="neutral">Read only list</Badge>
          Workflow actions and record entry are on the case details page.
        </p>
      ) : null}
    </>
  )
}
