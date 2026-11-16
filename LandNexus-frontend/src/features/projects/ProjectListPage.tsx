import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { getProjects } from '../../api/projects'
import type { ProjectResponse } from '../../api/types'
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
import { PROJECT_TYPE_LABELS } from '../proposals/labels'
import { ProjectStatusBadge } from './ProjectStatusBadge'

const FILTER_ALL = ''

export function ProjectListPage() {
  const refs = useReferenceNames()
  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const query = useApiQuery(
    () =>
      getProjects({
        districtId: districtId || undefined,
        page,
        size,
      }),
    [districtId, page, size],
  )

  const hasFilters = districtId !== FILTER_ALL
  const rows = query.data?.content ?? []

  function changeDistrict(next: string) {
    setDistrictId(next)
    setPage(0)
  }

  function clearFilters() {
    setDistrictId(FILTER_ALL)
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

  const columns: TableColumn<ProjectResponse>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (project) => (
        <div className="min-w-56">
          <Link
            to={`/projects/${project.id}`}
            className="font-semibold text-navy-900 hover:text-blue-700"
          >
            {project.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="font-mono">{project.code}</span>
            <span aria-hidden="true">·</span>
            <span>{PROJECT_TYPE_LABELS[project.projectType]}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (project) => <ProjectStatusBadge status={project.status} />,
    },
    {
      key: 'district',
      header: 'District',
      render: (project) => (
        <span title={project.districtId}>
          {refs.districtName(project.districtId) ?? shortId(project.districtId)}
        </span>
      ),
    },
    {
      key: 'approved',
      header: 'Approved',
      render: (project) => (
        <span className="whitespace-nowrap" title={project.approvedAt}>
          {formatDate(project.approvedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (project) => (
        <LinkButton to={`/projects/${project.id}`} variant="outline" size="sm">
          View
        </LinkButton>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Module 2 · Government projects"
        title="Projects"
        description="Projects created when a recommended proposal is approved, shown only within your role and geographic scope. Administrators with PROJECT_MANAGE can correct details and close or reopen a project."
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
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

          <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
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
            {query.data.totalElements === 1 ? 'project' : 'projects'}
            {hasFilters ? ' match your filter' : ' visible to you'}
            {refs.enabled && !refs.isLoading && refs.districts.length === 0
              ? ' · No districts are assigned to your account'
              : null}
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={query.error.status === 403 ? 'You do not have access' : 'Could not load projects'}
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(project) => project.id}
          isLoading={query.isLoading}
          caption="Government projects visible to you"
          emptyTitle={hasFilters ? 'No projects match this filter' : 'No projects yet'}
          emptyDescription={
            hasFilters
              ? 'Try another district, or clear the filter.'
              : 'A project appears here after a recommended proposal is approved.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
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
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge variant="neutral">Read only register</Badge>
          Projects are created only by approving a proposal. There are no create or edit actions.
        </p>
      ) : null}
    </>
  )
}
