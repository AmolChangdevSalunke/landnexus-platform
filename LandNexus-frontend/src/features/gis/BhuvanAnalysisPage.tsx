import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, FileText, FlaskConical, MapPin, Play, RotateCcw } from 'lucide-react'
import {
  exportBhuvanCsv,
  exportBhuvanPdf,
  geocodeBhuvanVillage,
  getBhuvanAnalysis,
  getBhuvanHistory,
  getBhuvanStatus,
  reverseGeocodeBhuvanVillage,
  runBhuvanLulc,
} from '../../api/bhuvan'
import { getProjects } from '../../api/projects'
import type {
  BhuvanHistoryItem,
  BhuvanLulcAnalysis,
  BhuvanVillageResult,
  ProjectResponse,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Tabs } from '../../components/ui/Tabs'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { saveBlob } from '../../utils/download'
import { formatArea, formatDateTime, formatNumber, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'

const STATUS_VARIANT = {
  SUCCESS: 'success',
  NO_DATA: 'warning',
  FAILED: 'danger',
} as const

const AOI_SOURCE_LABEL: Record<string, string> = {
  PROJECT_CORRIDOR: 'Project corridor',
  PROJECT_CORRIDOR_CONVEX_HULL: 'Project corridor (convex hull)',
  USER_WKT: 'Entered WKT polygon',
  USER_WKT_CONVEX_HULL: 'Entered WKT MultiPolygon (convex hull)',
}

const STATE_OPTIONS = [
  { code: 'MH', label: 'Maharashtra' },
  { code: 'AP', label: 'Andhra Pradesh' },
  { code: 'KA', label: 'Karnataka' },
]

function historyColumns(
  onOpen: (row: BhuvanHistoryItem) => void,
  onCsv: (row: BhuvanHistoryItem) => void,
  onPdf: (row: BhuvanHistoryItem) => void,
  busyId: string | null,
): TableColumn<BhuvanHistoryItem>[] {
  return [
    {
      key: 'run',
      header: 'Analysis',
      render: (row) => (
        <div className="min-w-52">
          <p className="font-mono text-xs text-slate-500">{shortId(row.runId)}</p>
          <p className="mt-0.5 font-semibold text-navy-900">
            {row.projectCode ?? 'Manual WKT AOI'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'place',
      header: 'State / district',
      render: (row) => (
        <span>{[row.stateName, row.districtName].filter(Boolean).join(' / ') || '—'}</span>
      ),
    },
    {
      key: 'aoi',
      header: 'AOI',
      render: (row) => (
        <div>
          <p>{AOI_SOURCE_LABEL[row.aoiSource] ?? row.aoiSource}</p>
          <p className="text-xs text-slate-500">{formatArea(row.aoiAreaHa)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status]}>{row.status.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'records',
      header: 'Rows',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (row) => (
        <div className="text-right">
          <p>{formatNumber(row.recordCount)}</p>
          <p className="text-xs text-slate-500">{formatNumber(row.totalAreaSqKm)} sq km</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpen(row)}>
            Open
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!row.resultAvailable || busyId === row.runId}
            onClick={() => onCsv(row)}
            leftIcon={<Download aria-hidden="true" className="h-3.5 w-3.5" />}
          >
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!row.resultAvailable || busyId === row.runId}
            onClick={() => onPdf(row)}
            leftIcon={<FileText aria-hidden="true" className="h-3.5 w-3.5" />}
          >
            PDF
          </Button>
        </div>
      ),
    },
  ]
}

export function BhuvanAnalysisPage() {
  const { can } = useAuth()
  const canReadGis = can(PERMISSION.GIS_READ)
  const refs = useReferenceNames()

  const [tab, setTab] = useState('lulc')
  const [projectId, setProjectId] = useState('')
  const [wkt, setWkt] = useState('')
  const [result, setResult] = useState<BhuvanLulcAnalysis | null>(null)
  const [historyProjectId, setHistoryProjectId] = useState('')
  const [historyPage, setHistoryPage] = useState(0)
  const [busyExport, setBusyExport] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [villageState, setVillageState] = useState('MH')
  const [villageName, setVillageName] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [villageResult, setVillageResult] = useState<BhuvanVillageResult | null>(null)

  const statusQuery = useApiQuery(() => getBhuvanStatus(), [], canReadGis)
  const projectsQuery = useApiQuery(
    () => getProjects({ page: 0, size: 100 }),
    [],
    canReadGis,
  )
  const historyQuery = useApiQuery(
    () => getBhuvanHistory(historyProjectId || undefined, historyPage, 10),
    [historyProjectId, historyPage],
    canReadGis && tab === 'history',
  )

  const analyseMutation = useApiMutation<BhuvanLulcAnalysis>()
  const openMutation = useApiMutation<BhuvanLulcAnalysis>()
  const geocodeMutation = useApiMutation<BhuvanVillageResult>()
  const reverseMutation = useApiMutation<BhuvanVillageResult>()

  const status = statusQuery.data
  const projects = projectsQuery.data?.content ?? []
  const selectedProject = projects.find((project) => project.id === projectId) ?? null
  const selectedStateCode =
    refs.states.find((state) => state.id === selectedProject?.stateId)?.code ?? ''

  const chartData = useMemo(
    () =>
      (result?.totals ?? []).slice(0, 8).map((item) => ({
        name: item.description.length > 22 ? `${item.description.slice(0, 22)}…` : item.description,
        area: item.areaSqKm,
      })),
    [result],
  )

  const villageColumns = useMemo<TableColumn<Record<string, unknown>>[]>(() => {
    const keys = new Set<string>()
    for (const record of villageResult?.records ?? []) {
      Object.keys(record).forEach((key) => keys.add(key))
    }
    return Array.from(keys).slice(0, 16).map((key) => ({
      key,
      header: key,
      render: (row) => {
        const value = row[key]
        return <span>{value === null || value === undefined || value === '' ? '—' : String(value)}</span>
      },
    }))
  }, [villageResult])

  async function runAnalysis() {
    setExportError(null)
    try {
      setResult(
        await analyseMutation.mutate(() =>
          runBhuvanLulc({ projectId: projectId || undefined, wkt: wkt || undefined }),
        ),
      )
      setTab('lulc')
    } catch {
      setResult(null)
    }
  }

  async function openRun(row: BhuvanHistoryItem) {
    try {
      setResult(await openMutation.mutate(() => getBhuvanAnalysis(row.runId)))
      setTab('lulc')
    } catch {
      // The mutation error is shown below the history table.
    }
  }

  async function download(runId: string, format: 'csv' | 'pdf') {
    setBusyExport(runId)
    setExportError(null)
    try {
      const file =
        format === 'csv' ? await exportBhuvanCsv(runId) : await exportBhuvanPdf(runId)
      saveBlob(file.blob, file.filename)
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'The export could not be downloaded.')
    } finally {
      setBusyExport(null)
    }
  }

  async function submitGeocode() {
    setVillageResult(null)
    try {
      setVillageResult(
        await geocodeMutation.mutate(() =>
          geocodeBhuvanVillage(villageName, villageState || undefined),
        ),
      )
    } catch {
      // The mutation error is shown next to the form.
    }
  }

  async function submitReverse() {
    setVillageResult(null)
    try {
      setVillageResult(
        await reverseMutation.mutate(() =>
          reverseGeocodeBhuvanVillage(Number(lat), Number(lon), villageState || undefined),
        ),
      )
    } catch {
      // The mutation error is shown next to the form.
    }
  }

  const lulcPanel = (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="LULC AOI analysis"
          description="The backend sends the AOI to Bhuvan and stores the answer. No Bhuvan token or provider URL reaches this page."
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Select
            label="Project (its current corridor is the AOI)"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            disabled={projectsQuery.isLoading}
            hint={
              selectedProject
                ? `${selectedProject.code} · ${refs.stateName(selectedProject.stateId) ?? selectedStateCode}`
                : 'A project needs a recorded alignment/corridor to be used as an AOI.'
            }
          >
            <option value="">No project — use the WKT below</option>
            {projects.map((project: ProjectResponse) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.title}
              </option>
            ))}
          </Select>
          <div>
            <Textarea
              label="Or enter a WKT Polygon"
              value={wkt}
              onChange={(event) => setWkt(event.target.value)}
              rows={5}
              placeholder="POLYGON((73.85 18.52, 73.86 18.52, 73.86 18.53, 73.85 18.53, 73.85 18.52))"
              hint="When both are present, the WKT is used. Coordinates are longitude latitude (WGS84)."
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void runAnalysis()}
            isLoading={analyseMutation.isLoading}
            disabled={!status?.enabled || (!projectId && !wkt.trim())}
            leftIcon={<Play aria-hidden="true" className="h-4 w-4" />}
          >
            Run LULC analysis
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null)
              setWkt('')
              setProjectId('')
            }}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Clear
          </Button>
          {selectedStateCode ? <Badge variant="info">State: {selectedStateCode}</Badge> : null}
        </div>
        {analyseMutation.error ? (
          <Alert variant="error" title="Bhuvan analysis failed" className="mt-3">
            {analyseMutation.error.message}
          </Alert>
        ) : null}
      </Card>

      {result ? (
        <Card className="p-4">
          <CardHeader
            title="Analysis result"
            description={`Stored run ${result.runId}. Source: ${AOI_SOURCE_LABEL[result.aoiSource] ?? result.aoiSource}.`}
            action={
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_VARIANT[result.status]}>{result.status.replace('_', ' ')}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void download(result.runId, 'csv')}
                  disabled={busyExport === result.runId}
                  leftIcon={<Download aria-hidden="true" className="h-3.5 w-3.5" />}
                >
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void download(result.runId, 'pdf')}
                  disabled={busyExport === result.runId}
                  leftIcon={<FileText aria-hidden="true" className="h-3.5 w-3.5" />}
                >
                  PDF
                </Button>
              </div>
            }
          />
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Project</dt>
              <dd className="mt-1 font-semibold text-navy-900">{result.projectCode ?? 'Manual WKT AOI'}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">State / district</dt>
              <dd className="mt-1 font-semibold text-navy-900">
                {[result.stateName, result.districtName].filter(Boolean).join(' / ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">AOI area</dt>
              <dd className="mt-1 font-semibold text-navy-900">{formatArea(result.aoiAreaHa)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">LULC rows</dt>
              <dd className="mt-1 font-semibold text-navy-900">
                {formatNumber(result.records.length)}
                {result.years.length > 0 ? (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    · {result.years.join(', ')}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {result.message ? (
            <Alert
              variant={result.status === 'SUCCESS' ? 'info' : 'warning'}
              className="mt-3"
            >
              {result.message}
            </Alert>
          ) : null}

          {chartData.length > 0 ? (
            <div className="mt-4 h-72" aria-label="Bar chart of LULC class areas">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 48, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} />
                  <Tooltip formatter={(value) => [`${formatNumber(Number(value))} sq km`, 'Area']} />
                  <Bar dataKey="area" fill="#1D4ED8" maxBarSize={48} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className="mt-4">
            <DataTable
              columns={[
                {
                  key: 'year',
                  header: 'Year',
                  render: (row) => row.year ?? '—',
                },
                {
                  key: 'description',
                  header: 'LULC description',
                  render: (row) => row.description,
                },
                {
                  key: 'area',
                  header: 'Area (sq km)',
                  className: 'text-right',
                  headerClassName: 'text-right',
                  render: (row) => formatNumber(row.areaSqKm),
                },
              ]}
              rows={result.records}
              rowKey={(row) => JSON.stringify(row)}
              caption="Bhuvan LULC rows for this AOI"
              emptyTitle="No LULC rows"
              emptyDescription="The provider returned no records, or the answer could not be mapped to the usual Year / LULC description / Area fields."
            />
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-navy-900">
              Raw Bhuvan response
            </summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          </details>
        </Card>
      ) : null}
    </div>
  )

  const historyPanel = (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Analysis history"
          description="Every LULC request is stored, including failed token or coverage checks. Exports reproduce the stored answer."
        />
        <div className="mt-4 max-w-md">
          <Select
            label="Filter by project"
            value={historyProjectId}
            onChange={(event) => {
              setHistoryProjectId(event.target.value)
              setHistoryPage(0)
            }}
          >
            <option value="">All projects and manual AOIs</option>
            {projects.map((project: ProjectResponse) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.title}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      {historyQuery.error ? (
        <Alert variant="error" title="Analysis history could not be loaded">
          {historyQuery.error.message}
        </Alert>
      ) : null}
      {openMutation.error ? (
        <Alert variant="error" title="The stored analysis could not be opened">
          {openMutation.error.message}
        </Alert>
      ) : null}
      {exportError ? (
        <Alert variant="error" title="Export failed">
          {exportError}
        </Alert>
      ) : null}
      <DataTable
        columns={historyColumns(
          (row) => void openRun(row),
          (row) => void download(row.runId, 'csv'),
          (row) => void download(row.runId, 'pdf'),
          busyExport,
        )}
        rows={historyQuery.data?.content ?? []}
        rowKey={(row) => row.runId}
        isLoading={historyQuery.isLoading}
        caption="Bhuvan LULC analysis history"
        emptyTitle="No analysis yet"
        emptyDescription="Run an LULC AOI analysis to create the first history entry."
        page={historyQuery.data?.page ?? historyPage}
        size={historyQuery.data?.size ?? 10}
        totalElements={historyQuery.data?.totalElements ?? 0}
        totalPages={historyQuery.data?.totalPages}
        onPageChange={setHistoryPage}
      />
    </div>
  )

  const villagePanel = (
    <div className="space-y-4">
      <Alert variant="warning" title="Coverage is not the same for every endpoint">
        Bhuvan documents village geocoding and reverse geocoding for Andhra Pradesh and Karnataka only.
        {status?.maharashtraVillageVerified
          ? ' This installation records a verified Maharashtra check.'
          : ' Maharashtra is blocked by this backend until an operator verifies it; LULC AOI analysis is not affected.'}
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeader
            title="Village geocoding"
            description="Look up census details by village name."
          />
          <div className="mt-4 space-y-3">
            <Input
              label="Village name"
              value={villageName}
              onChange={(event) => setVillageName(event.target.value)}
              placeholder="For example: SEKURU"
            />
            <Select
              label="State"
              value={villageState}
              onChange={(event) => setVillageState(event.target.value)}
            >
              {STATE_OPTIONS.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.label}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => void submitGeocode()}
              isLoading={geocodeMutation.isLoading}
              disabled={!status?.enabled || villageName.trim().length < 2}
              leftIcon={<MapPin aria-hidden="true" className="h-4 w-4" />}
            >
              Geocode village
            </Button>
            {geocodeMutation.error ? (
              <Alert variant="error" title="Village lookup failed">
                {geocodeMutation.error.message}
              </Alert>
            ) : null}
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader
            title="Village reverse geocoding"
            description="Look up the village at a latitude and longitude."
          />
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Latitude"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                placeholder="18.5204"
                inputMode="decimal"
              />
              <Input
                label="Longitude"
                value={lon}
                onChange={(event) => setLon(event.target.value)}
                placeholder="73.8567"
                inputMode="decimal"
              />
            </div>
            <Select
              label="State"
              value={villageState}
              onChange={(event) => setVillageState(event.target.value)}
            >
              {STATE_OPTIONS.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.label}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => void submitReverse()}
              isLoading={reverseMutation.isLoading}
              disabled={!status?.enabled || !lat.trim() || !lon.trim()}
              leftIcon={<MapPin aria-hidden="true" className="h-4 w-4" />}
            >
              Reverse geocode
            </Button>
            {reverseMutation.error ? (
              <Alert variant="error" title="Reverse lookup failed">
                {reverseMutation.error.message}
              </Alert>
            ) : null}
          </div>
        </Card>
      </div>

      {villageResult ? (
        <Card className="p-4">
          <CardHeader
            title={`Village result for ${villageResult.query}`}
            description={`${villageResult.recordCount} record(s). ${villageResult.coverageNote}`}
          />
          <div className="mt-4">
            <DataTable
              columns={villageColumns}
              rows={villageResult.records}
              rowKey={(row) => String(row.vid ?? JSON.stringify(row))}
              caption="Bhuvan village records"
              emptyTitle="No village data"
              emptyDescription="Bhuvan returned false/null for this lookup, which its documentation describes as no data."
            />
          </div>
        </Card>
      ) : null}
    </div>
  )

  if (!canReadGis) {
    return (
      <Card>
        <Alert variant="warning" title="GIS read permission is required">
          Ask an administrator for GIS_READ to use the Bhuvan endpoints.
        </Alert>
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace · GIS analysis"
        title="Bhuvan analysis"
        description="ISRO Bhuvan LULC statistics for a project corridor or WKT AOI, with village lookups where the provider documents coverage. The backend holds the access token."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void statusQuery.reload()
              void projectsQuery.reload()
            }}
            disabled={statusQuery.isLoading}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      {statusQuery.error ? (
        <Alert variant="error" title="Bhuvan status could not be loaded" className="mb-4">
          {statusQuery.error.message}
        </Alert>
      ) : status ? (
        <Alert
          variant={status.enabled && status.tokenConfigured ? 'info' : 'warning'}
          title={status.enabled && status.tokenConfigured ? 'Bhuvan configured' : 'Bhuvan not configured'}
          className="mb-4"
        >
          {status.message}{' '}
          Village lookup documented states: {status.documentedVillageStates.join(', ') || 'none'}.
          {status.maharashtraVillageVerified ? ' Maharashtra is marked verified.' : ' Maharashtra is not verified.'}
        </Alert>
      ) : null}

      <Tabs
        label="Bhuvan sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'lulc', label: 'LULC AOI analysis', content: lulcPanel },
          { id: 'history', label: 'Analysis history', content: historyPanel },
          { id: 'village', label: 'Village lookup', content: villagePanel },
        ]}
      />

      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">Backend-only token</Badge>
        <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
        A result is only shown as successful when Bhuvan actually answered; provider errors and no-data answers are kept separately.
      </p>
    </>
  )
}
