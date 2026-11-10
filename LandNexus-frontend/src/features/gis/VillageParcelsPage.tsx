import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MapPinned, RotateCcw } from 'lucide-react'
import { getVillageParcels } from '../../api/gis'
import type { FeatureCollection, MapProps } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatArea, shortId } from '../../utils/format'
import { useScopeDistricts } from '../myWork/useScopeDistricts'
import { GeoJsonSvg } from './GeoJsonSvg'

const FILTER_ALL = ''
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMPTY_PARCELS: FeatureCollection<MapProps> = {
  type: 'FeatureCollection',
  features: [],
}

/**
 * Village-level parcel map. Every boundary shown here was entered by an
 * officer; parcels without a recorded boundary are simply absent.
 */
export function VillageParcelsPage() {
  const refs = useReferenceNames()
  const scope = useScopeDistricts()
  const refsEnabled = refs.enabled

  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [villageId, setVillageId] = useState(FILTER_ALL)
  const [villageUuid, setVillageUuid] = useState('')
  const [uuidError, setUuidError] = useState<string | undefined>()
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)

  const { ensureDistrictVillages } = refs

  useEffect(() => {
    setVillageId(FILTER_ALL)
    setSelectedParcelId(null)
    if (!refsEnabled || districtId === FILTER_ALL) {
      return
    }
    ensureDistrictVillages(districtId).catch(() => {
      // Village options stay unavailable; the UUID fallback below still works.
    })
  }, [districtId, ensureDistrictVillages, refsEnabled])

  const villagesLoading =
    refsEnabled && districtId !== FILTER_ALL && refs.isDistrictVillagesLoading(districtId)
  const villages = refsEnabled && districtId !== FILTER_ALL
    ? refs.villagesForDistrict(districtId)
    : []

  const activeVillageId = refsEnabled ? villageId : villageUuid.trim()
  const activeVillageName =
    villages.find((village) => village.id === activeVillageId)?.name ?? null

  const parcelsQuery = useApiQuery(
    () => getVillageParcels(activeVillageId),
    [activeVillageId],
    Boolean(activeVillageId),
  )

  const parcels = parcelsQuery.data ?? EMPTY_PARCELS
  const parcelFeatures = parcels.features.filter(
    (feature) => feature.properties.kind === 'PARCEL',
  )
  const drawnAreaHa = parcelFeatures.reduce(
    (total, feature) =>
      feature.properties.kind === 'PARCEL' ? total + feature.properties.areaHa : total,
    0,
  )

  const districtOptions =
    scope.isNationwide || scope.districts.length === 0
      ? refs.districts
      : scope.districts
  const districtFilterDisabled =
    !refsEnabled ||
    districtOptions.length === 0 ||
    ((!scope.isNationwide && (scope.isLoading || scope.error !== null)) ||
      (scope.isNationwide && (refs.isLoading || refs.error !== null)))

  function submitUuid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = villageUuid.trim()
    if (!UUID_PATTERN.test(trimmed)) {
      setUuidError('Enter the village UUID, for example 3fa85f64-5717-4562-b3fc-2c963f66afa6.')
      return
    }
    setUuidError(undefined)
    setSelectedParcelId(null)
    setVillageUuid(trimmed)
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace · GIS"
        title="Village parcels"
        description="Every recorded parcel boundary of one village on a single map. A parcel appears here only after a field officer records its boundary GeoJSON."
        actions={
          <Button
            variant="outline"
            onClick={parcelsQuery.reload}
            disabled={!activeVillageId || parcelsQuery.isLoading}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <Card className="p-4">
        <CardHeader
          title="Choose a village"
          description="The village list comes from administrative master data and your geographic scope."
        />

        <div className="mt-4">
          {!refsEnabled ? (
            <form onSubmit={submitUuid} className="max-w-md space-y-3">
              <Alert variant="info">
                Your role cannot read administrative master data, so village
                names cannot be listed. Paste the village UUID instead — the
                backend still applies GIS_READ and your scope.
              </Alert>
              <Input
                label="Village UUID"
                required
                value={villageUuid}
                onChange={(event) => {
                  setVillageUuid(event.target.value)
                  setUuidError(undefined)
                }}
                error={uuidError}
                hint="Example: 3fa85f64-5717-4562-b3fc-2c963f66afa6"
              />
              <Button type="submit">Show village parcels</Button>
            </form>
          ) : (
            <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
              <Select
                label="District"
                value={districtId}
                onChange={(event) => setDistrictId(event.target.value)}
                disabled={districtFilterDisabled}
                hint={
                  districtFilterDisabled
                    ? 'District options are not available right now.'
                    : scope.isNationwide
                      ? 'All districts from master data.'
                      : 'Only districts in your scope are listed.'
                }
              >
                <option value={FILTER_ALL}>Select a district</option>
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

              <Select
                label="Village"
                value={villageId}
                onChange={(event) => {
                  setVillageId(event.target.value)
                  setSelectedParcelId(null)
                }}
                disabled={districtId === FILTER_ALL || villagesLoading}
                hint={
                  districtId === FILTER_ALL
                    ? 'Select a district first.'
                    : villagesLoading
                      ? 'Loading villages…'
                      : `${villages.length} villages in the selected district.`
                }
              >
                <option value={FILTER_ALL}>Select a village</option>
                {[...villages]
                  .sort((left, right) => left.name.localeCompare(right.name))
                  .map((village) => (
                    <option key={village.id} value={village.id}>
                      {village.name}
                    </option>
                  ))}
              </Select>
            </div>
          )}
        </div>
      </Card>

      {activeVillageId ? (
        activeVillageName ? (
          <Card className="p-4">
            <CardHeader
              title={`Parcels of ${activeVillageName}`}
              description="Boundaries come from the backend; parcels without a recorded boundary are absent."
              action={<Badge variant="info">{parcelFeatures.length} with boundary</Badge>}
            />
            <div className="mt-4">
              {parcelsQuery.isLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : parcelsQuery.error ? (
                <ErrorState
                  title="Could not load the village parcels"
                  message={parcelsQuery.error.message}
                  onRetry={parcelsQuery.reload}
                />
              ) : parcelFeatures.length === 0 ? (
                <EmptyState
                  title="No recorded boundaries in this village"
                  description="A field officer records parcel boundaries on each parcel's details page with GIS_WRITE."
                  action={
                    <Link
                      to="/land/parcels"
                      className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Open the land parcel register
                    </Link>
                  }
                />
              ) : (
                <>
                  <GeoJsonSvg
                    data={parcels}
                    height={520}
                    selectedParcelId={selectedParcelId}
                    onSelectParcel={setSelectedParcelId}
                    label={`Recorded parcel boundaries of village ${activeVillageName}`}
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    {parcelFeatures.length} parcels · {formatArea(drawnAreaHa)} of drawn
                    boundaries in total. The drawn total is a count of returned
                    records, not a valuation.
                  </p>
                </>
              )}
            </div>
          </Card>
        ) : parcelsQuery.isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : parcelsQuery.error ? (
          <Card>
            <ErrorState
              title="Could not load the village parcels"
              message={parcelsQuery.error.message}
              onRetry={parcelsQuery.reload}
            />
          </Card>
        ) : (
          <Card className="p-4">
            <CardHeader
              title={`Parcels of village ${shortId(activeVillageId)}`}
              description="The village name is not available to this role, so the short identifier is shown."
            />
            <div className="mt-4">
              {parcelFeatures.length === 0 ? (
                <EmptyState
                  title="No recorded boundaries in this village"
                  description="Either no boundary has been recorded yet, or the identifier does not match a village in your scope."
                />
              ) : (
                <GeoJsonSvg
                  data={parcels}
                  height={520}
                  selectedParcelId={selectedParcelId}
                  onSelectParcel={setSelectedParcelId}
                  label={`Recorded parcel boundaries of village ${activeVillageId}`}
                />
              )}
            </div>
          </Card>
        )
      ) : (
        <Card className="p-4">
          <CardHeader
            title="No village selected"
            description="Select a district and a village to see every recorded parcel boundary on one map."
          />
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <MapPinned aria-hidden="true" className="h-4 w-4" />
            A parcel appears here only after its boundary is recorded by an officer.
          </div>
        </Card>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Village{' '}
        {activeVillageId ? (
          <span className="font-mono" title={activeVillageId}>
            {activeVillageId}
          </span>
        ) : (
          '—'
        )}
        {parcelFeatures.length > 0
          ? ` · ${parcelFeatures.length} parcels with a recorded boundary`
          : ''}
      </p>
    </>
  )
}
