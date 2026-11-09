import { useState } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  getProjectAlignment,
  getProjectAlignmentHistory,
  getProjectCorridor,
  setProjectAlignment,
} from '../../api/gis'
import type {
  AlignmentResponse,
  AlignmentVersion,
  Feature,
  FeatureCollection,
  Geometry,
  MapProps,
  ProjectResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDateTime, formatLength, formatNumber } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { GeoJsonSvg } from './GeoJsonSvg'
import { GeometryEntryForm } from './GeometryEntryForm'

export function AlignmentPanel({ project }: { project: ProjectResponse }) {
  const { can } = useAuth()
  const dispatch = useAppDispatch()
  const canWrite = can(PERMISSION.GIS_WRITE)
  const [reloadTick, setReloadTick] = useState(0)
  const [corridorWidth, setCorridorWidth] = useState('30')
  const [widthError, setWidthError] = useState<string | null>(null)
  const mutation = useApiMutation<AlignmentResponse>()

  const alignmentQuery = useApiQuery(
    () => getProjectAlignment(project.id),
    [project.id, reloadTick],
  )
  const corridorQuery = useApiQuery(
    () => getProjectCorridor(project.id),
    [project.id, reloadTick],
  )
  const historyQuery = useApiQuery(
    () => getProjectAlignmentHistory(project.id),
    [project.id, reloadTick],
  )

  const noAlignment = alignmentQuery.error?.status === 404
  const history = historyQuery.data ?? []
  const currentVersion = history.find((version) => version.current) ?? history[0] ?? null

  const mapFeatures: Feature<MapProps>[] = []
  if (alignmentQuery.data) {
    mapFeatures.push({
      type: 'Feature',
      geometry: alignmentQuery.data.geometry,
      properties: {
        kind: 'ALIGNMENT',
        lengthKm: alignmentQuery.data.properties.lengthKm,
        corridorWidthM: alignmentQuery.data.properties.corridorWidthM,
      },
    })
  }
  if (corridorQuery.data) {
    mapFeatures.push({
      type: 'Feature',
      geometry: corridorQuery.data.geometry,
      properties: {
        kind: 'CORRIDOR',
        corridorWidthM: corridorQuery.data.properties.corridorWidthM,
      },
    })
  }
  const mapData: FeatureCollection<MapProps> = {
    type: 'FeatureCollection',
    features: mapFeatures,
  }

  function validateWidth(): string | null {
    const parsed = Number(corridorWidth)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1000) {
      const message = 'Enter a corridor width between 1 and 1000 metres.'
      setWidthError(message)
      return message
    }
    setWidthError(null)
    return null
  }

  async function save(geometry: Geometry, sourceNote: string) {
    const parsedWidth = Number(corridorWidth)
    try {
      await mutation.mutate(() =>
        setProjectAlignment(project.id, geometry, parsedWidth, sourceNote || undefined),
      )
      dispatch(
        addToast({ variant: 'success', message: 'Alignment version saved by the server.' }),
      )
      setReloadTick((current) => current + 1)
    } catch {
      // The form shows the server message verbatim.
    }
  }

  const historyColumns: TableColumn<AlignmentVersion>[] = [
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
      key: 'length',
      header: 'Length',
      className: 'whitespace-nowrap',
      render: (version) => formatLength(version.lengthKm),
    },
    {
      key: 'width',
      header: 'Corridor width',
      className: 'whitespace-nowrap',
      render: (version) => `${formatNumber(version.corridorWidthM)} m`,
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

  return (
    <div className="space-y-4">
      <Alert variant="info" title="Alignment is entered by officers">
        Paste one GeoJSON LineString or MultiLineString. The corridor is generated by the server
        from the alignment and the corridor width. No base map or external tile is used.
      </Alert>

      {alignmentQuery.error && !noAlignment ? (
        <Card>
          <ErrorState
            title="Could not load the alignment"
            message={alignmentQuery.error.message}
            onRetry={alignmentQuery.reload}
          />
        </Card>
      ) : alignmentQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : noAlignment || !alignmentQuery.data ? (
        <Card>
          <CardHeader
            title="No alignment recorded yet"
            description={
              canWrite
                ? 'Enter the first alignment below. The conflict report becomes available after it is saved.'
                : 'A field officer enters the alignment with GIS_WRITE.'
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
              label="Length"
              value={currentVersion ? formatLength(currentVersion.lengthKm) : '—'}
            />
            <SummaryCard
              label="Corridor width"
              value={currentVersion ? `${formatNumber(currentVersion.corridorWidthM)} m` : '—'}
            />
            <SummaryCard
              label="Vertices"
              value={currentVersion ? formatNumber(currentVersion.vertices) : '—'}
            />
          </div>

          <Card className="p-4">
            <CardHeader
              title="Current alignment and corridor"
              description="Both shapes are returned by the backend for this project."
            />
            <div className="mt-4">
              <GeoJsonSvg
                data={mapData}
                height={420}
                label={`Current alignment and corridor for project ${project.code}`}
              />
            </div>
          </Card>
        </>
      )}

      <Card className="p-4">
        <CardHeader
          title="Alignment history"
          description="A new alignment creates the next version. Older versions stay visible."
        />
        {historyQuery.error ? (
          <ErrorState
            title="Could not load the alignment history"
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
              caption="Alignment versions"
              emptyTitle="No alignment versions"
              emptyDescription="The first saved alignment creates version 1."
            />
          </div>
        )}
      </Card>

      {canWrite ? (
        <GeometryEntryForm
          kind="line"
          previewProperties={{ kind: 'ALIGNMENT', lengthKm: 0 }}
          submitLabel="Save alignment"
          onSave={save}
          isSaving={mutation.isLoading}
          serverError={mutation.error?.message ?? null}
          validateExtra={validateWidth}
          extraFields={
            <Input
              label="Corridor width (metres)"
              required
              type="number"
              min={1}
              max={1000}
              step={1}
              value={corridorWidth}
              onChange={(event) => {
                setCorridorWidth(event.target.value)
                setWidthError(null)
              }}
              error={widthError ?? undefined}
              hint="The server accepts a width from 1 to 1000 metres."
            />
          }
          previewLabel={`Preview of the alignment for project ${project.code}`}
        />
      ) : (
        <Alert variant="info" title="Read-only alignment">
          Your role can read the alignment but not change it. GIS_WRITE is required to enter a new
          version.
        </Alert>
      )}
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
