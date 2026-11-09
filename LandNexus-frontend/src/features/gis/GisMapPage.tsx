import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { getProjects } from '../../api/projects'
import type { ProjectResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Select } from '../../components/ui/Select'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, shortId } from '../../utils/format'
import { PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { normalizeMapName } from '../myWork/mapNames'
import { useScopeDistricts } from '../myWork/useScopeDistricts'
import { PROJECT_TYPE_LABELS } from '../proposals/labels'
import { ProjectStatusBadge } from '../projects/ProjectStatusBadge'

const ScopeMap = lazy(() =>
  import('../myWork/ScopeMap').then((module) => ({ default: module.ScopeMap })),
)

const FILTER_ALL = ''

export function GisMapPage() {
  const { canAny } = useAuth()
  const refs = useReferenceNames()
  const scope = useScopeDistricts()
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)

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
    canReadProjects,
  )

  const rows = query.data?.content ?? []
  const hasFilters = districtId !== FILTER_ALL

  const districtOptions = useMemo(() => {
    if (scope.isNationwide) {
      return refs.districts
    }
    if (scope.districts.length > 0) {
      return scope.districts
    }
    return refs.districts
  }, [refs.districts, scope.districts, scope.isNationwide])

  const selectedDistrict = districtOptions.find((district) => district.id === districtId)
  const districtFilterDisabled =
    districtOptions.length === 0 ||
    ((!scope.isNationwide && (scope.isLoading || scope.error !== null)) ||
      (scope.isNationwide && (refs.isLoading || refs.error !== null)))

  function changeDistrict(next: string) {
    setDistrictId(next)
    setPage(0)
  }

  function selectDistrictOnMap(name: string) {
    const match = districtOptions.find(
      (district) => normalizeMapName(district.name) === normalizeMapName(name),
    )
    if (match) {
      changeDistrict(match.id)
    }
  }

  function clearFilters() {
    setDistrictId(FILTER_ALL)
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  const scopeDescription = scope.isLoading
    ? 'Loading your geographic scope…'
    : scope.error
      ? 'Your geographic scope could not be loaded right now.'
      : scope.isNationwide
        ? 'Nation-wide access: the map shows every state returned by the backend.'
        : scope.districts.length === 1
          ? 'The map is zoomed to the single district in your scope.'
          : `${scope.districts.length} districts are assigned to your scope.`

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
        <Link
          to={`/projects/${project.id}`}
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          View
        </Link>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Workspace · Geographic map"
        title="GIS map"
        description="A district-level view of the projects your role and geographic scope allow. The map uses bundled boundary geometry and only colours places that contain real ACTIVE projects returned by the backend."
        actions={
          <Button
            variant="outline"
            onClick={query.reload}
            disabled={query.isLoading || !canReadProjects}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <Alert variant="info" title="Backend-scoped map" className="mb-4">
        {scopeDescription} A missing district is either outside your scope or has no ongoing
        project. The frontend never receives a wider dataset and hides part of it.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-4">
          <CardHeader
            title="Project coverage"
            description="Boundaries come from the bundled map data; colours come from real project districts."
            action={<Badge variant="info">Read only</Badge>}
          />

          <div className="mt-4">
            <Suspense
              fallback={
                <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
                  Loading map…
                </div>
              }
            >
              <ScopeMap
                width={640}
                height={520}
                className="border-0 bg-transparent p-0 shadow-none"
                onSelectDistrict={selectDistrictOnMap}
                selectedDistrictName={selectedDistrict?.name ?? null}
              />
            </Suspense>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Select a district on the map to filter the project table. Only districts inside your
            geographic scope are selectable; the nation view uses the district filter instead.
          </p>
        </Card>

        <Card className="flex h-fit flex-col p-4">
          <CardHeader
            title="Filter projects"
            description="Filters are applied by the backend before pagination."
          />

          <div className="mt-4 space-y-4">
            <Select
              label="District"
              value={districtId}
              onChange={(event) => changeDistrict(event.target.value)}
              disabled={districtFilterDisabled}
              hint={
                districtFilterDisabled
                  ? 'District options are not available right now.'
                  : scope.isNationwide
                    ? 'All districts from master data.'
                    : 'Only districts in your scope are listed.'
              }
            >
              <option value={FILTER_ALL}>All districts</option>
              {districtOptions
                .filter((district) => district.status === 'ACTIVE' || district.id === districtId)
                .map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
            </Select>

            <div className="flex flex-wrap gap-2">
              {hasFilters ? (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                >
                  Clear filter
                </Button>
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Visible projects
                </dt>
                <dd className="mt-1 text-2xl font-bold text-navy-900">
                  {query.isLoading ? '…' : (query.data?.totalElements ?? '—')}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Scope
                </dt>
                <dd className="mt-1 text-sm font-semibold text-navy-900">
                  {scope.isNationwide
                    ? 'Nation-wide'
                    : scope.isLoading
                      ? '…'
                      : scope.error
                        ? 'Unavailable'
                        : `${scope.districts.length} ${scope.districts.length === 1 ? 'district' : 'districts'}`}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        {!canReadProjects ? (
          <Alert variant="warning" title="Project list unavailable">
            Listing projects needs proposal read access. The map still shows your geographic
            scope, but it cannot highlight or list projects for this account.
          </Alert>
        ) : query.error ? (
          <Card>
            <ErrorState
              title={
                query.error.status === 403 ? 'You do not have access' : 'Could not load projects'
              }
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
            caption="Projects plotted on the GIS map"
            emptyTitle={hasFilters ? 'No projects in this district' : 'No projects yet'}
            emptyDescription={
              hasFilters
                ? 'The district has no project visible to your account. Clear the filter to see all permitted projects.'
                : 'A project appears here after a recommended proposal is approved.'
            }
            emptyAction={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filter
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
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">No invented geometry</Badge>
        This page shows project locations at district level only. Parcel boundaries, alignments and
        the conflict report are on each project and parcel details page, and are drawn only from
        officer-entered GeoJSON. No owner data appears here.
      </p>
    </>
  )
}
