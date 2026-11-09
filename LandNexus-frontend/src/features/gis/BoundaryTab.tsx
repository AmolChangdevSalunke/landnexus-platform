import { useState } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  getParcelBoundary,
  getParcelBoundaryHistory,
  setParcelBoundary,
} from '../../api/gis'
import type {
  BoundaryResponse,
  BoundaryVersion,
  FeatureCollection,
  Geometry,
  MapProps,
  ParcelResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatArea, formatDateTime, formatNumber } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { GeoJsonSvg } from './GeoJsonSvg'
import { GeometryEntryForm } from './GeometryEntryForm'

function variancePercent(drawn: number, recorded: number): number | null {
  if (!Number.isFinite(drawn) || !Number.isFinite(recorded) || recorded <= 0) {
    return null
  }
  return ((drawn - recorded) / recorded) * 100
}

export function BoundaryTab({ parcel }: { parcel: ParcelResponse }) {
  const { can } = useAuth()
  const dispatch = useAppDispatch()
  const canWrite = can(PERMISSION.GIS_WRITE)
  const [reloadTick, setReloadTick] = useState(0)
  const mutation = useApiMutation<BoundaryResponse>()

  const boundaryQuery = useApiQuery(
    () => getParcelBoundary(parcel.id),
    [parcel.id, reloadTick],
  )
  const historyQuery = useApiQuery(
    () => getParcelBoundaryHistory(parcel.id),
    [parcel.id, reloadTick],
  )

  const hasBoundary = Boolean(boundaryQuery.data)
  const noBoundary = boundaryQuery.error?.status === 404
  const history = historyQuery.data ?? []
  const currentVersion = history.find((version) => version.current) ?? history[0] ?? null
  const variance = currentVersion
    ? variancePercent(currentVersion.areaHa, parcel.areaHa)
    : null

  const previewProperties: MapProps = {
    kind: 'PARCEL',
    parcelId: parcel.id,
    gatNumber: parcel.gatNumber,
    surveyNumber: parcel.surveyNumber,
    classification: parcel.classification,
    landUse: parcel.landUse,
    areaHa: parcel.areaHa,
    inCase: false,
  }

  const boundaryData: FeatureCollection<MapProps> | null = boundaryQuery.data
    ? {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: boundaryQuery.data.geometry,
            properties: previewProperties,
          },
        ],
      }
    : null

  const historyColumns: TableColumn<BoundaryVersion>[] = [
    {
      key: 'version',
      header: 'Version',
      render: (version) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-navy-900">v{version.versionNo}</span>
          {version.current ? <Badge variant="success">Current</Badge> : null}
        </div>
      ),
    },
    {
      key: 'area',
      header: 'Drawn area',
      className: 'whitespace-nowrap',
      render: (version) => formatArea(version.areaHa),
    },
    {
      key: 'vertices',
      header: 'Vertices',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (version) => formatNumber(version.vertices),
    },
    {
      key: 'source',
      header: 'Source note',
      render: (version) =>
        version.sourceNote ? (
          <span className="text-sm text-slate-700">{version.sourceNote}</span>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        ),
    },
    {
      key: 'entered',
      header: 'Entered',
      render: (version) => (
        <div className="min-w-32">
          <p className="text-sm text-slate-700">{version.enteredByUsername}</p>
          <p className="text-xs text-slate-500">{formatDateTime(version.enteredAt)}</p>
        </div>
      ),
    },
  ]

  async function save(geometry: Geometry, sourceNote: string) {
    try {
      await mutation.mutate(() => setParcelBoundary(parcel.id, geometry, sourceNote || undefined))
      dispatch(
        addToast({ variant: 'success', message: 'Boundary version saved by the server.' }),
      )
      setReloadTick((current) => current + 1)
    } catch {
      // The form shows the server message verbatim.
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info" title="Boundary geometry is entered by officers">
        This page never generates, guesses or downloads a shape. Paste GeoJSON or read a file in
        this browser. The variance is information only and is never treated as an error.
      </Alert>

      {boundaryQuery.error && !noBoundary ? (
        <Card>
          <ErrorState
            title="Could not load the boundary"
            message={boundaryQuery.error.message}
            onRetry={boundaryQuery.reload}
          />
        </Card>
      ) : boundaryQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : noBoundary || !hasBoundary ? (
        <Card>
          <CardHeader
            title="No boundary recorded yet"
            description={
              canWrite
                ? 'Enter the first boundary below. A new call creates version 1.'
                : 'A field officer enters the parcel boundary with GIS_WRITE.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Current version"
              value={currentVersion ? `v${currentVersion.versionNo}` : '—'}
            />
            <SummaryCard
              label="Drawn area"
              value={currentVersion ? formatArea(currentVersion.areaHa) : '—'}
            />
            <SummaryCard label="Recorded area" value={formatArea(parcel.areaHa)} />
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Variance (information only)
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-bold text-navy-900">
                {variance === null ? '—' : `${variance.toFixed(2)}%`}
                <Badge variant="neutral">Not an error</Badge>
              </p>
            </div>
          </div>

          {boundaryData ? (
            <Card className="p-4">
              <CardHeader
                title="Current boundary"
                description="Drawn from the current version returned by the backend."
              />
              <div className="mt-4">
                <GeoJsonSvg
                  data={boundaryData}
                  height={420}
                  label={`Current boundary for parcel ${parcel.id}`}
                />
              </div>
            </Card>
          ) : null}
        </>
      )}

      <Card className="p-4">
        <CardHeader
          title="Version history"
          description="A new boundary creates the next version. Older versions stay visible."
        />
        {historyQuery.error ? (
          <ErrorState
            title="Could not load the boundary history"
            message={historyQuery.error.message}
            onRetry={historyQuery.reload}
          />
        ) : (
          <div className="mt-4">
            <DataTable
              columns={historyColumns}
              rows={history}
              rowKey={(version) => String(version.versionNo)}
              isLoading={historyQuery.isLoading}
              caption="Boundary versions"
              emptyTitle="No boundary versions"
              emptyDescription="The first saved boundary creates version 1."
            />
          </div>
        )}
      </Card>

      {canWrite ? (
        <GeometryEntryForm
          kind="polygon"
          previewProperties={previewProperties}
          submitLabel="Save boundary"
          onSave={save}
          isSaving={mutation.isLoading}
          serverError={mutation.error?.message ?? null}
          previewLabel={`Preview of the boundary for parcel ${parcel.id}`}
        />
      ) : (
        <Alert variant="info" title="Read-only boundary">
          Your role can read the boundary but not change it. GIS_WRITE is required to enter a new
          version.
        </Alert>
      )}

      <p className="text-xs text-slate-500">
        The server validates the geometry: it rejects self-crossing shapes, wrong geometry types,
        elevation values, swapped or non-Indian coordinates, too many points and shapes that are
        too small. Its 400 message is shown exactly as returned.
      </p>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-navy-900">{value}</p>
    </div>
  )
}
