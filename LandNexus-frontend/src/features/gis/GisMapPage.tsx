import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import {
  getImageryStatus,
  getProjectMap,
  getVillageParcels,
  setParcelBoundary,
  setProjectAlignment,
} from '../../api/gis'
import { getTalukas, getVillages } from '../../api/administration'
import { getParcels } from '../../api/landRecords'
import { getProjects } from '../../api/projects'
import type { Geometry, ProjectResponse } from '../../api/types'
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
import { PERMISSION, PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { normalizeMapName } from '../myWork/mapNames'
import { useScopeDistricts } from '../myWork/useScopeDistricts'
import { PROJECT_TYPE_LABELS } from '../proposals/labels'
import { ProjectStatusBadge } from '../projects/ProjectStatusBadge'
import { InteractiveGisMap } from './InteractiveGisMap'
import { ImageryStatusCard } from './ImageryStatusCard'

const ScopeMap = lazy(() =>
  import('../myWork/ScopeMap').then((module) => ({ default: module.ScopeMap })),
)

const FILTER_ALL = ''

export function GisMapPage() {
  const { can, canAny } = useAuth()
  const refs = useReferenceNames()
  const scope = useScopeDistricts()
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)
  const canReadGis = can(PERMISSION.GIS_READ)
  const canReadMasterData = can(PERMISSION.MASTER_DATA_READ)
  const canWriteGis = can(PERMISSION.GIS_WRITE)
  const canReadLandRecords = can(PERMISSION.LAND_RECORD_READ)

  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [talukaId, setTalukaId] = useState('')
  const [villageId, setVillageId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [parcelSearch, setParcelSearch] = useState('')
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
  const talukasQuery = useApiQuery(
    () => getTalukas(districtId, 0, 100),
    [districtId],
    Boolean(districtId) && canReadMasterData,
  )
  const villagesQuery = useApiQuery(
    () => getVillages(talukaId, 0, 100),
    [talukaId],
    Boolean(talukaId) && canReadMasterData,
  )
  const parcelDataQuery = useApiQuery(
    () => getVillageParcels(villageId),
    [villageId],
    Boolean(villageId) && canReadGis,
  )
  const parcelCandidatesQuery = useApiQuery(
    () => getParcels({ villageId, number: parcelSearch || undefined, page: 0, size: 100 }),
    [villageId, parcelSearch],
    Boolean(villageId) && canReadLandRecords && canWriteGis,
  )
  const imageryStatusQuery = useApiQuery(
    () => getImageryStatus(),
    [],
    canReadGis,
  )
  const selectedProjectId = rows.some((project) => project.id === projectId)
    ? projectId
    : rows[0]?.id ?? ''
  const projectMapQuery = useApiQuery(
    () => getProjectMap(selectedProjectId),
    [selectedProjectId],
    Boolean(selectedProjectId) && canReadGis,
  )

  async function persistGeometry(
    kind: 'PARCEL' | 'ALIGNMENT',
    geometry: Geometry,
    parcelId?: string,
  ) {
    if (!canWriteGis) {
      throw new Error('GIS write permission is required to save geometry.')
    }
    if (kind === 'PARCEL') {
      if (!parcelId) {
        throw new Error('Select a parcel before saving this polygon.')
      }
      await setParcelBoundary(parcelId, geometry, 'GeoJSON upload from GIS map')
      await parcelDataQuery.reload()
      return
    }
    if (!selectedProjectId) {
      throw new Error('Select a project before saving this alignment.')
    }
    await setProjectAlignment(selectedProjectId, geometry, 100, 'GeoJSON upload from GIS map')
    await projectMapQuery.reload()
  }

  useEffect(() => {
    if (selectedProjectId !== projectId) {
      setProjectId(selectedProjectId)
    }
  }, [projectId, selectedProjectId])

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
    setTalukaId('')
    setVillageId('')
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

      <Card className="p-4">
        <CardHeader
          title="Interactive land acquisition map"
          description="OpenStreetMap is the always-available base layer; stored PostGIS features and authorized imagery are optional overlays."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Land district (parcel lookup)"
            value={districtId}
            onChange={(event) => changeDistrict(event.target.value)}
            disabled={districtFilterDisabled}
          >
            <option value="">Select a district</option>
            {districtOptions
              .filter((district) => district.status === 'ACTIVE' || district.id === districtId)
              .map((district) => (
                <option key={district.id} value={district.id}>{district.name}</option>
              ))}
          </Select>
          <Select
            label="Taluka"
            value={talukaId}
            onChange={(event) => {
              setTalukaId(event.target.value)
              setVillageId('')
            }}
            disabled={!districtId || talukasQuery.isLoading || Boolean(talukasQuery.error)}
          >
            <option value="">Select a taluka</option>
            {(talukasQuery.data?.content ?? []).map((taluka) => (
              <option key={taluka.id} value={taluka.id}>{taluka.name}</option>
            ))}
          </Select>
          <Select
            label="Village / parcel layer"
            value={villageId}
            onChange={(event) => setVillageId(event.target.value)}
            disabled={!talukaId || villagesQuery.isLoading || Boolean(villagesQuery.error)}
          >
            <option value="">Select a village</option>
            {(villagesQuery.data?.content ?? []).map((village) => (
              <option key={village.id} value={village.id}>{village.name}</option>
            ))}
          </Select>
          <Select
            label="Project alignment / conflict layer"
            value={selectedProjectId}
            onChange={(event) => setProjectId(event.target.value)}
            disabled={rows.length === 0 || !canReadGis}
          >
            <option value="">No project selected</option>
            {rows.map((project) => (
              <option key={project.id} value={project.id}>{project.code} · {project.title}</option>
            ))}
          </Select>
          <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4">
            Search survey or Gat number
            <input
              value={parcelSearch}
              onChange={(event) => setParcelSearch(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Search within the selected village's mapped parcels"
            />
          </label>
        </div>
        {talukasQuery.error ? (
          <Alert variant="error" title="Taluka list could not be loaded" className="mt-3">
            {talukasQuery.error.message}
          </Alert>
        ) : null}
        {villagesQuery.error ? (
          <Alert variant="error" title="Village list could not be loaded" className="mt-3">
            {villagesQuery.error.message}
          </Alert>
        ) : null}
        {projectMapQuery.error && projectMapQuery.error.status !== 404 ? (
          <Alert variant="error" title="Project GIS data could not be loaded" className="mt-3">
            {projectMapQuery.error.message}
          </Alert>
        ) : null}
        {parcelDataQuery.error && parcelDataQuery.error.status !== 404 ? (
          <Alert variant="error" title="Village parcel GIS data could not be loaded" className="mt-3">
            {parcelDataQuery.error.message}
          </Alert>
        ) : null}
        <div className="mt-4">
          <InteractiveGisMap
            projectData={projectMapQuery.data ?? null}
            parcelData={parcelDataQuery.data ?? null}
            projectName={rows.find((project) => project.id === selectedProjectId)?.title ?? null}
            villageName={villagesQuery.data?.content.find((village) => village.id === villageId)?.name ?? null}
            parcelSearch={parcelSearch}
            imageryEnabled={imageryStatusQuery.data?.enabled ?? false}
            imageryProvider={imageryStatusQuery.data?.provider ?? null}
            parcelCandidates={parcelCandidatesQuery.data?.content ?? []}
            canPersistGeometry={canWriteGis}
            onPersistGeometry={persistGeometry}
          />
        </div>
      </Card>

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

        <div className="flex flex-col gap-4">
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

          <ImageryStatusCard />
        </div>
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
