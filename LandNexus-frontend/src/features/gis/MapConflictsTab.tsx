import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { getProjectConflicts, getProjectMap } from '../../api/gis'
import type {
  AffectedParcel,
  ConflictReport,
  FeatureCollection,
  MapProps,
  ProjectResponse,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatArea, shortId } from '../../utils/format'
import { LAND_CLASSIFICATION_LABELS, LAND_USE_LABELS } from '../landRecords/labels'
import { GeoJsonSvg, parcelTitle } from './GeoJsonSvg'
import {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  SEVERITY_VARIANTS,
  findingLabel,
} from './labels'

type ParcelProps = Extract<MapProps, { kind: 'PARCEL' }>

const EMPTY_MAP: FeatureCollection<MapProps> = {
  type: 'FeatureCollection',
  features: [],
}

export function MapConflictsTab({ project }: { project: ProjectResponse }) {
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)

  const mapQuery = useApiQuery(() => getProjectMap(project.id), [project.id])
  const conflictsQuery = useApiQuery(
    () => getProjectConflicts(project.id),
    [project.id],
  )

  const mapData = mapQuery.data ?? EMPTY_MAP
  const mapParcels = useMemo(
    () =>
      mapData.features.flatMap((feature) =>
        feature.properties.kind === 'PARCEL' ? [feature.properties] : [],
      ),
    [mapData.features],
  )

  const report = conflictsQuery.data
  const noAlignment = conflictsQuery.error?.status === 404

  const sortedFindings = useMemo(() => {
    if (!report) {
      return []
    }
    return [...report.findings].sort(
      (left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity],
    )
  }, [report])

  const warnings = sortedFindings.filter((finding) => finding.severity === 'WARNING')
  const infos = sortedFindings.filter((finding) => finding.severity === 'INFO')

  const parcelColumns: TableColumn<ParcelProps>[] = [
    {
      key: 'parcel',
      header: 'Parcel',
      render: (parcel) => (
        <div className="min-w-36">
          <Link
            to={`/land/parcels/${parcel.parcelId}`}
            className="font-semibold text-navy-900 hover:text-blue-700"
            onClick={(event) => event.stopPropagation()}
          >
            {parcelTitle(parcel)}
          </Link>
          <p className="text-xs text-slate-500">{LAND_CLASSIFICATION_LABELS[parcel.classification]}</p>
        </div>
      ),
    },
    {
      key: 'use',
      header: 'Land use',
      render: (parcel) => LAND_USE_LABELS[parcel.landUse],
    },
    {
      key: 'area',
      header: 'Drawn area',
      className: 'whitespace-nowrap',
      render: (parcel) => formatArea(parcel.areaHa),
    },
    {
      key: 'case',
      header: 'Case',
      render: (parcel) =>
        parcel.inCase ? (
          <Badge variant="success">In case</Badge>
        ) : (
          <Badge variant="warning">No case</Badge>
        ),
    },
  ]

  const affectedColumns: TableColumn<AffectedParcel>[] = [
    {
      key: 'parcel',
      header: 'Parcel',
      render: (parcel) => (
        <div className="min-w-36">
          <Link
            to={`/land/parcels/${parcel.parcelId}`}
            className="font-semibold text-navy-900 hover:text-blue-700"
          >
            {parcel.gatNumber ?? parcel.surveyNumber
              ? `Gat ${parcel.gatNumber ?? parcel.surveyNumber}`
              : `Parcel ${shortId(parcel.parcelId)}`}
          </Link>
          <p className="text-xs text-slate-500">
            {LAND_CLASSIFICATION_LABELS[parcel.classification]} ·{' '}
            {LAND_USE_LABELS[parcel.landUse]}
          </p>
        </div>
      ),
    },
    {
      key: 'recorded',
      header: 'Recorded',
      className: 'whitespace-nowrap',
      render: (parcel) => formatArea(parcel.recordedAreaHa),
    },
    {
      key: 'drawn',
      header: 'Drawn',
      className: 'whitespace-nowrap',
      render: (parcel) => formatArea(parcel.boundaryAreaHa),
    },
    {
      key: 'affected',
      header: 'Crossed',
      className: 'whitespace-nowrap',
      render: (parcel) => formatArea(parcel.affectedHa),
    },
    {
      key: 'case',
      header: 'Case',
      render: (parcel) => (
        <div className="space-y-1">
          {parcel.caseNumber ? (
            <span className="font-mono text-xs text-slate-700">{parcel.caseNumber}</span>
          ) : (
            <span className="text-xs text-slate-500">No case</span>
          )}
          {parcel.areaToAcquireHa !== null ? (
            <p className="text-xs text-slate-500">
              {formatArea(parcel.areaToAcquireHa)} to acquire
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (parcel) =>
        parcel.flags.length === 0 ? (
          <span className="text-xs text-slate-500">—</span>
        ) : (
          <div className="flex max-w-72 flex-wrap gap-1">
            {parcel.flags.map((flag) => (
              <Badge key={flag} variant="neutral">
                {findingLabel(flag)}
              </Badge>
            ))}
          </div>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <Alert variant="info" title="Indicators, not legal decisions">
        Findings on this page point to something an officer may want to check. They are not a
        legal decision and this system does not use the words violation, illegal or
        approved/rejected for a finding. No owner names or personal data appear on this map or
        report.
      </Alert>

      {mapQuery.error ? (
        <Card>
          <ErrorState
            title={
              mapQuery.error.status === 404
                ? 'Project map not found'
                : 'Could not load the project map'
            }
            message={mapQuery.error.message}
            onRetry={mapQuery.reload}
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <Card className="p-4">
            <CardHeader
              title="Map"
              description="Corridor, alignment and the parcels that cross the corridor. Drawn from officer-entered GeoJSON only."
            />
            {mapQuery.isLoading ? (
              <Skeleton className="mt-4 h-[520px] w-full" />
            ) : (
              <div className="mt-4">
                <GeoJsonSvg
                  data={mapData}
                  selectedParcelId={selectedParcelId}
                  onSelectParcel={setSelectedParcelId}
                  label={`Project map for ${project.code}`}
                />
              </div>
            )}
          </Card>

          <Card className="p-4">
            <CardHeader
              title="Parcels on the map"
              description="Selecting a row highlights the same parcel on the map."
            />
            <div className="mt-4">
              <DataTable
                columns={parcelColumns}
                rows={mapParcels}
                rowKey={(parcel) => parcel.parcelId}
                isLoading={mapQuery.isLoading}
                onRowClick={(parcel) => setSelectedParcelId(parcel.parcelId)}
                rowSelected={(parcel) => parcel.parcelId === selectedParcelId}
                caption="Parcels drawn on the project map"
                emptyTitle="No parcels cross the corridor"
                emptyDescription="A parcel appears here after its boundary overlaps the corridor."
              />
            </div>
          </Card>
        </div>
      )}

      {conflictsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : noAlignment ? (
        <Card>
          <EmptyState
            title="No alignment recorded yet"
            description="Enter an alignment in the Alignment panel. The conflict report becomes available after the first alignment is saved."
          />
        </Card>
      ) : conflictsQuery.error ? (
        <Card>
          <ErrorState
            title="Could not load the conflict report"
            message={conflictsQuery.error.message}
            onRetry={conflictsQuery.reload}
          />
        </Card>
      ) : report ? (
        <ConflictReportView
          report={report}
          warnings={warnings}
          infos={infos}
          affectedColumns={affectedColumns}
          onSelectParcel={setSelectedParcelId}
        />
      ) : null}
    </div>
  )
}

function ConflictReportView({
  report,
  warnings,
  infos,
  affectedColumns,
  onSelectParcel,
}: {
  report: ConflictReport
  warnings: ConflictReport['findings']
  infos: ConflictReport['findings']
  affectedColumns: TableColumn<AffectedParcel>[]
  onSelectParcel: (parcelId: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Parcels crossed" value={String(report.affectedParcelCount)} />
        <SummaryCard label="Total crossed area" value={formatArea(report.totalAffectedHa)} />
        <SummaryCard label="Warnings" value={String(report.warnings)} />
        <SummaryCard label="Information" value={String(report.infos)} />
        <SummaryCard
          label="Boundary coverage"
          value={`${report.parcelsWithBoundary} of ${report.parcelsInProjectVillages}`}
          hint="parcels in the project villages have a boundary"
        />
      </div>

      <Card className="p-4">
        <CardHeader
          title="Findings"
          description={`Alignment version ${report.alignmentVersion} · corridor width ${report.corridorWidthM} m · corridor area ${formatArea(report.corridorAreaHa)}.`}
        />

        {report.findings.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
            The server returned no findings for this alignment.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {warnings.length > 0 ? (
              <FindingGroup
                title="Warnings"
                severity="WARNING"
                findings={warnings}
                onSelectParcel={onSelectParcel}
              />
            ) : null}
            {infos.length > 0 ? (
              <FindingGroup
                title="Information"
                severity="INFO"
                findings={infos}
                onSelectParcel={onSelectParcel}
              />
            ) : null}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <CardHeader
          title="Affected parcels"
          description="Recorded area comes from land records; drawn area comes from the boundary GeoJSON; crossed area is the overlap with the corridor."
        />
        <div className="mt-4">
          <DataTable
            columns={affectedColumns}
            rows={report.affectedParcels}
            rowKey={(parcel) => parcel.parcelId}
            onRowClick={(parcel) => onSelectParcel(parcel.parcelId)}
            caption={`Affected parcels for project ${report.projectCode}`}
            emptyTitle="No parcels cross the corridor"
            emptyDescription="No current parcel boundary overlaps this corridor."
          />
        </div>
      </Card>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Limitations of this report</p>
        {report.limitations.length === 0 ? (
          <p className="mt-1">The server did not return any limitations.</p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {report.limitations.map((limitation, index) => (
              <li key={`${limitation}-${index}`}>{limitation}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function FindingGroup({
  title,
  severity,
  findings,
  onSelectParcel,
}: {
  title: string
  severity: 'WARNING' | 'INFO'
  findings: ConflictReport['findings']
  onSelectParcel: (parcelId: string) => void
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2">
        {severity === 'WARNING' ? (
          <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warning-600" />
        ) : (
          <Info aria-hidden="true" className="h-4 w-4 text-blue-600" />
        )}
        <h3 className="text-sm font-semibold text-navy-900">
          {title} ({findings.length})
        </h3>
        <Badge variant={SEVERITY_VARIANTS[severity]}>{SEVERITY_LABELS[severity]}</Badge>
      </div>
      <ul className="mt-2 space-y-2">
        {findings.map((finding, index) => (
          <li
            key={`${finding.code}-${finding.parcelId ?? 'project'}-${index}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={SEVERITY_VARIANTS[finding.severity]}>
                {findingLabel(finding.code)}
              </Badge>
              {finding.parcelId ? (
                <Link
                  to={`/land/parcels/${finding.parcelId}`}
                  onClick={() => onSelectParcel(finding.parcelId as string)}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  Open parcel
                </Link>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-700">{finding.message}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-navy-900">{value}</p>
      {hint ? <p className="text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  )
}
