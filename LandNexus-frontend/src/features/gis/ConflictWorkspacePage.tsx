import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { getProject, getProjects } from '../../api/projects'
import type { ProjectResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, shortId } from '../../utils/format'
import { PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { useScopeDistricts } from '../myWork/useScopeDistricts'
import { PROJECT_TYPE_LABELS } from '../proposals/labels'
import { ProjectStatusBadge } from '../projects/ProjectStatusBadge'
import { MapConflictsTab } from './MapConflictsTab'

const FILTER_ALL = ''

/**
 * Standalone conflict workspace: pick a project, then read the full spatial
 * conflict report the backend computes for its corridor. Project details keep
 * their own tab; this page exists so an officer can reach the report without
 * opening the whole project.
 */
export function ConflictWorkspacePage() {
  const { canAny } = useAuth()
  const refs = useReferenceNames()
  const scope = useScopeDistricts()
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('project')

  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const listQuery = useApiQuery(
    () =>
      getProjects({
        districtId: districtId || undefined,
        page,
        size,
      }),
    [districtId, page, size],
    canReadProjects && !selectedId,
  )

  const selectedQuery = useApiQuery<ProjectResponse | null>(
    () => (selectedId ? getProject(selectedId) : Promise.resolve(null)),
    [selectedId],
    Boolean(selectedId),
  )

  const rows = listQuery.data?.content ?? []
  const hasFilters = districtId !== FILTER_ALL

  const districtOptions =
    scope.isNationwide || scope.districts.length === 0
      ? refs.districts
      : scope.districts
  const districtFilterDisabled =
    districtOptions.length === 0 ||
    ((!scope.isNationwide && (scope.isLoading || scope.error !== null)) ||
      (scope.isNationwide && (refs.isLoading || refs.error !== null)))

  function changeDistrict(next: string) {
    setDistrictId(next)
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  function openProject(projectId: string) {
    setSearchParams({ project: projectId })
  }

  function backToFinder() {
    setSearchParams({})
  }

  const columns: TableColumn<ProjectResponse>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (project) => (
        <div className="min-w-56">
          <p className="font-semibold text-navy-900">{project.title}</p>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => openProject(project.id)}
        >
          Review conflicts
        </Button>
      ),
    },
  ]

  const selectedProject = selectedQuery.data

  return (
    <>
      <PageHeader
        eyebrow="Workspace · GIS"
        title="Conflict workspace"
        description="The spatial conflict report of one project: findings, affected parcels and the corridor map, computed by the backend from officer-entered geometry. Findings are indicators for review, never a legal decision."
        actions={
          selectedId ? (
            <Button
              variant="outline"
              onClick={backToFinder}
              leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
            >
              Back to project finder
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={listQuery.reload}
              disabled={!canReadProjects || listQuery.isLoading}
              leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
            >
              Refresh
            </Button>
          )
        }
      />

      {selectedId ? (
        selectedQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : selectedQuery.error ? (
          <Card>
            <ErrorState
              title="Could not open this project"
              message={selectedQuery.error.message}
              onRetry={selectedQuery.reload}
            />
          </Card>
        ) : selectedProject ? (
          <div className="space-y-4">
            <Card className="p-4">
              <CardHeader
                title={selectedProject.title}
                description="The full report below is the same computation shown on the project's map tab."
                action={<ProjectStatusBadge status={selectedProject.status} />}
              />
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Project code
                  </dt>
                  <dd className="mt-0.5 font-mono text-sm text-slate-800">
                    {selectedProject.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Type
                  </dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {PROJECT_TYPE_LABELS[selectedProject.projectType]}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    District
                  </dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {refs.districtName(selectedProject.districtId) ??
                      shortId(selectedProject.districtId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Full record
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    <Link
                      to={`/projects/${selectedProject.id}`}
                      className="font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Open project details
                    </Link>
                  </dd>
                </div>
              </dl>
            </Card>

            <MapConflictsTab project={selectedProject} />
          </div>
        ) : null
      ) : (
        <>
          {!canReadProjects ? (
            <Alert variant="warning" title="Project finder unavailable">
              Listing projects needs proposal read access. Open a project from
              its details page instead — its map tab shows the same conflict
              report.
            </Alert>
          ) : listQuery.error ? (
            <Card>
              <ErrorState
                title={
                  listQuery.error.status === 403
                    ? 'You do not have access'
                    : 'Could not load projects'
                }
                message={listQuery.error.message}
                onRetry={listQuery.reload}
              />
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <CardHeader
                  title="Find a project"
                  description="Filters are applied by the backend before pagination."
                />
                <div className="mt-4 max-w-sm">
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
                      .filter(
                        (district) =>
                          district.status === 'ACTIVE' || district.id === districtId,
                      )
                      .map((district) => (
                        <option key={district.id} value={district.id}>
                          {district.name}
                        </option>
                      ))}
                  </Select>
                </div>
              </Card>

              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(project) => project.id}
                isLoading={listQuery.isLoading}
                caption="Projects with a conflict report"
                emptyTitle={
                  hasFilters ? 'No projects in this district' : 'No projects yet'
                }
                emptyDescription={
                  hasFilters
                    ? 'The district has no project visible to your account. Clear the filter to see all permitted projects.'
                    : 'A project appears here after a recommended proposal is approved.'
                }
                page={listQuery.data?.page ?? page}
                size={listQuery.data?.size ?? size}
                totalElements={listQuery.data?.totalElements ?? 0}
                totalPages={listQuery.data?.totalPages}
                onPageChange={setPage}
                onSizeChange={changeSize}
              />
            </>
          )}
        </>
      )}

      <p className="mt-3 text-xs text-slate-500">
        The report is computed by the backend from recorded parcel boundaries and
        the project corridor. Nothing is summed or decided in the browser, and
        owner data never appears here.
      </p>
    </>
  )
}
