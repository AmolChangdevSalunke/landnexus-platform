import { useMemo } from 'react'
import { getState, getStates, loadDistricts } from 'vardhan-maps/data'
import { fitProjection, type Projection } from 'vardhan-maps/svg'
import { Card } from '../../components/ui/Card'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useProjectCoverage } from './useProjectCoverage'
import { useScopeDistricts } from './useScopeDistricts'

/* ------------------------------------------------------------------ */
/* Map geometry types (the library types depend on @types/geojson, so   */
/* this component narrows only the fields it actually reads)            */
/* ------------------------------------------------------------------ */

type Position = [number, number]
type Ring = Position[]
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }

interface BoundaryProperties {
  name: string
  state?: string
  code?: string
}

interface BoundaryFeature {
  type: 'Feature'
  properties: BoundaryProperties
  geometry: Geometry
}

interface MapData {
  /** View key this payload belongs to, so stale geometry is never drawn. */
  key: string
  features: BoundaryFeature[]
  /** True when a scoped boundary could not be matched and the state is shown. */
  boundaryFallback: boolean
}

type MapLevel = 'nation' | 'state' | 'division' | 'district'

interface ScopeView {
  level: MapLevel
  /** Canonical name used by the bundled map data. */
  stateName: string | null
  /** Name exactly as the backend returns it. */
  stateLabel: string | null
  divisionName: string | null
  districtName: string | null
  scopeDistrictNames: string[]
}

interface RenderedPath {
  key: string
  name: string
  d: string
  fill: string
  stroke: string
  strokeWidth: number
}

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

const MAP_WIDTH = 320
const MAP_HEIGHT = 300
const MAP_PADDING = 14

const NO_PROJECT_FILL = '#FFFFFF'
const STATE_BOUNDARY = '#94A3B8'
const DISTRICT_BOUNDARY = '#CBD5E1'
const FOCUS_BOUNDARY = '#64748B'

/** One distinct colour per area that actually has an ongoing project. */
const PROJECT_COLORS = [
  '#EA580C',
  '#0284C7',
  '#16A34A',
  '#9333EA',
  '#DC2626',
  '#CA8A04',
  '#0891B2',
  '#DB2777',
  '#4F46E5',
  '#65A30D',
  '#0D9488',
  '#B45309',
  '#7C3AED',
  '#BE123C',
  '#059669',
  '#2563EB',
]

function colorForIndex(index: number): string {
  if (index < PROJECT_COLORS.length) {
    return PROJECT_COLORS[index]
  }
  const hue = Math.round((index * 137.508) % 360)
  return `hsl(${hue} 68% 42%)`
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    // The map dataset names districts like "Pune District"; the backend does not.
    .replace(/\bdistrict\b/g, '')
    .replace(/\bdivision\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function buildPalette(names: string[]): Map<string, string> {
  const palette = new Map<string, string>()
  unique(names.map(normalize))
    .sort((left, right) => left.localeCompare(right))
    .forEach((name, index) => palette.set(name, colorForIndex(index)))
  return palette
}

/* ------------------------------------------------------------------ */
/* Scope → view level                                                  */
/* ------------------------------------------------------------------ */

function findStateName(label: string): string | null {
  const direct = getState(label)
  if (direct) {
    return direct.properties.name
  }

  const target = normalize(label)
  const match = getStates().find((feature) => normalize(feature.properties.name) === target)
  return match?.properties.name ?? null
}

interface ScopeInput {
  districts: ReturnType<typeof useScopeDistricts>['districts']
  isNationwide: boolean
  enabled: boolean
  isLoading: boolean
  error: unknown
}

/**
 * Mirrors the backend scope: nationwide roles see India, a single state sees
 * that state, a single division sees that division, and a single district sees
 * only that district.
 */
function deriveView(scope: ScopeInput): ScopeView | null {
  if (scope.isNationwide) {
    return {
      level: 'nation',
      stateName: null,
      stateLabel: null,
      divisionName: null,
      districtName: null,
      scopeDistrictNames: [],
    }
  }

  if (!scope.enabled || scope.isLoading || scope.error || scope.districts.length === 0) {
    return null
  }

  const stateLabels = unique(scope.districts.map((district) => district.stateName).filter(Boolean))

  if (stateLabels.length !== 1) {
    // Scope spans more than one state, so the country is the only complete view.
    return {
      level: 'nation',
      stateName: null,
      stateLabel: null,
      divisionName: null,
      districtName: null,
      scopeDistrictNames: [],
    }
  }

  const stateLabel = stateLabels[0]
  const scopeDistrictNames = scope.districts.map((district) => district.name)

  if (scope.districts.length === 1) {
    const district = scope.districts[0]
    return {
      level: 'district',
      stateName: findStateName(stateLabel),
      stateLabel,
      divisionName: district.divisionName,
      districtName: district.name,
      scopeDistrictNames,
    }
  }

  const divisionNames = unique(
    scope.districts
      .map((district) => district.divisionName)
      .filter((name): name is string => Boolean(name)),
  )

  if (divisionNames.length === 1) {
    return {
      level: 'division',
      stateName: findStateName(stateLabel),
      stateLabel,
      divisionName: divisionNames[0],
      districtName: null,
      scopeDistrictNames,
    }
  }

  return {
    level: 'state',
    stateName: findStateName(stateLabel),
    stateLabel,
    divisionName: null,
    districtName: null,
    scopeDistrictNames,
  }
}

function viewKey(view: ScopeView): string {
  return [
    view.level,
    view.stateName ?? '',
    [...view.scopeDistrictNames].sort().join(','),
  ].join('|')
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function eachRing(geometry: Geometry, visit: (ring: Ring) => void): void {
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      visit(ring)
    }
    return
  }

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      visit(ring)
    }
  }
}

function boundsOf(features: BoundaryFeature[]): [number, number, number, number] | null {
  let minLng = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  for (const feature of features) {
    eachRing(feature.geometry, (ring) => {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng
        if (lat < minLat) minLat = lat
        if (lng > maxLng) maxLng = lng
        if (lat > maxLat) maxLat = lat
      }
    })
  }

  if (!Number.isFinite(minLng)) {
    return null
  }

  return [minLng, minLat, maxLng, maxLat]
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function pathFor(feature: BoundaryFeature, projection: Projection): string {
  let path = ''

  eachRing(feature.geometry, (ring) => {
    ring.forEach(([lng, lat], index) => {
      const [x, y] = projection.project(lng, lat)
      path += `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`
    })
    path += 'Z'
  })

  return path
}

function buildPaths(
  data: MapData,
  level: MapLevel,
  highlightedNames: string[],
): RenderedPath[] {
  const bounds = boundsOf(data.features)
  if (!bounds) {
    return []
  }

  const projection = fitProjection(bounds, MAP_WIDTH, MAP_HEIGHT, MAP_PADDING)
  const palette = buildPalette(highlightedNames)
  const stroke = data.boundaryFallback || level === 'district' ? FOCUS_BOUNDARY : level === 'nation' ? STATE_BOUNDARY : DISTRICT_BOUNDARY
  const strokeWidth = data.boundaryFallback || level === 'district' ? 1 : level === 'nation' ? 0.8 : 0.7

  return data.features.map((feature, index) => {
    const name = feature.properties.name
    return {
      key: `${normalize(name)}-${index}`,
      name,
      d: pathFor(feature, projection),
      fill: palette.get(normalize(name)) ?? NO_PROJECT_FILL,
      stroke,
      strokeWidth,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

async function loadMapData(view: ScopeView, key: string): Promise<MapData> {
  if (view.level === 'nation') {
    return {
      key,
      features: getStates() as unknown as BoundaryFeature[],
      boundaryFallback: false,
    }
  }

  if (!view.stateName) {
    return { key, features: [], boundaryFallback: false }
  }

  const districts = (await loadDistricts(view.stateName, {
    resolution: 'low',
  })) as unknown as BoundaryFeature[]

  if (view.level === 'state') {
    return { key, features: districts, boundaryFallback: false }
  }

  const scope = new Set(view.scopeDistrictNames.map(normalize))
  const scoped = districts.filter((feature) => scope.has(normalize(feature.properties.name)))

  if (scoped.length > 0) {
    return { key, features: scoped, boundaryFallback: false }
  }

  // A boundary name may differ between the backend and the map dataset. Showing
  // the state is safer than showing nothing, and the caller reports the fallback.
  return { key, features: districts, boundaryFallback: districts.length > 0 }
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

function mapLabel(view: ScopeView, boundaryFallback: boolean): string {
  if (view.level === 'nation' || boundaryFallback) {
    return 'Map of India showing states with ongoing projects'
  }

  if (view.level === 'state') {
    return `Map of ${view.stateLabel} showing districts with ongoing projects`
  }

  if (view.level === 'division') {
    return `Map of ${view.divisionName} division in ${view.stateLabel} showing districts with ongoing projects`
  }

  return `Map of ${view.districtName} district in ${view.stateLabel} showing ongoing projects`
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ScopeMap() {
  const scope = useScopeDistricts()
  const coverage = useProjectCoverage()

  const view = deriveView({
    districts: scope.districts,
    isNationwide: scope.isNationwide,
    enabled: scope.enabled,
    isLoading: scope.isLoading,
    error: scope.error,
  })

  const key = view ? viewKey(view) : 'none'
  const geometry = useApiQuery(
    () => (view ? loadMapData(view, key) : Promise.resolve(null)),
    [key],
    Boolean(view),
  )

  const data = geometry.data && geometry.data.key === key ? geometry.data : null

  const districtNameById = useMemo(
    () => new Map(scope.districts.map((district) => [district.id, district.name])),
    [scope.districts],
  )
  const projectDistrictNames = useMemo(
    () =>
      coverage.districtIds
        .map((id) => districtNameById.get(id))
        .filter((name): name is string => Boolean(name)),
    [coverage.districtIds, districtNameById],
  )

  const highlightedNames =
    view?.level === 'nation' ? coverage.stateNames : projectDistrictNames

  const paths = data && view ? buildPaths(data, view.level, highlightedNames) : []
  const legend = paths
    .filter((path) => path.fill !== NO_PROJECT_FILL)
    .map((path) => ({ name: path.name, color: path.fill }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const renderedNames = new Set(paths.map((path) => normalize(path.name)))
  const unmatched = unique(highlightedNames).filter(
    (name) => !renderedNames.has(normalize(name)),
  )

  const isLoading = scope.isLoading || geometry.isLoading || coverage.isLoading
  const boundaryFallback = Boolean(data?.boundaryFallback)
  const label = view ? mapLabel(view, boundaryFallback) : 'Scope map'

  const emptyMessage = (() => {
    if (!scope.enabled) {
      return 'The map needs master data read access.'
    }
    if (scope.error) {
      return scope.error.message
    }
    if (scope.isLoading) {
      return 'Loading map…'
    }
    if (!view) {
      return 'No districts are assigned to your scope yet.'
    }
    if (geometry.isLoading) {
      return 'Loading map boundaries…'
    }
    if (geometry.error) {
      return geometry.error.message
    }
    if (!data) {
      return 'Loading map boundaries…'
    }
    if (data.features.length === 0) {
      return view.stateLabel
        ? `Map boundary data is unavailable for ${view.stateLabel}.`
        : 'Map boundary data is unavailable for your scope.'
    }
    return 'No ongoing projects to highlight yet.'
  })()

  const highlightMessage = coverage.enabled
    ? null
    : 'Project highlights need proposal read access.'

  return (
    <Card className="overflow-hidden bg-white p-3">
      <div
        role="img"
        aria-label={label}
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        {paths.length > 0 ? (
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full"
            style={{ maxHeight: MAP_HEIGHT }}
          >
            {paths.map((path) => (
              <path
                key={path.key}
                d={path.d}
                fill={path.fill}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              >
                <title>{path.name}</title>
              </path>
            ))}
          </svg>
        ) : (
          <div className="flex h-[300px] items-center justify-center px-6 text-center text-xs leading-5 text-slate-500">
            {emptyMessage}
          </div>
        )}

        {isLoading && paths.length > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs font-medium text-slate-600">
            Loading map…
          </div>
        ) : null}
      </div>

      {legend.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
          {legend.map((entry) => (
            <li
              key={entry.name}
              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          {highlightMessage ??
            (isLoading ? 'Loading project locations…' : 'No ongoing projects to highlight yet.')}
        </p>
      )}

      {legend.length > 0 && highlightMessage ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-500">{highlightMessage}</p>
      ) : null}

      {boundaryFallback ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Showing the state map because a scoped district boundary could not be matched.
        </p>
      ) : null}

      {unmatched.length > 0 && !isLoading ? (
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          {unmatched.length === 1
            ? `Project area “${unmatched[0]}” is not in the map boundary data.`
            : `${unmatched.length} project areas are not in the map boundary data.`}
        </p>
      ) : null}
    </Card>
  )
}
