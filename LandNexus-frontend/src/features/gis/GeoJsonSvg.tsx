import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { Feature, FeatureCollection, MapProps } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { shortId } from '../../utils/format'
import {
  LAND_CLASSIFICATION_LABELS,
  LAND_USE_LABELS,
} from '../landRecords/labels'
import {
  createProjection,
  geometryPositions,
  geometryToPath,
  niceScaleBar,
  type Projection,
} from './projection'

const WIDTH = 900
const DEFAULT_HEIGHT = 520

type ParcelFeature = Feature<
  Extract<MapProps, { kind: 'PARCEL' }>
> & { properties: Extract<MapProps, { kind: 'PARCEL' }> }

type AlignmentFeature = Feature<
  Extract<MapProps, { kind: 'ALIGNMENT' }>
> & { properties: Extract<MapProps, { kind: 'ALIGNMENT' }> }

type CorridorFeature = Feature<Extract<MapProps, { kind: 'CORRIDOR' }>>

interface Layers {
  corridor: boolean
  parcels: boolean
  alignment: boolean
}

export interface GeoJsonSvgProps {
  data: FeatureCollection<MapProps>
  height?: number
  selectedParcelId?: string | null
  onSelectParcel?: (parcelId: string) => void
  label?: string
}

function isParcel(feature: Feature<MapProps>): feature is ParcelFeature {
  return feature.properties.kind === 'PARCEL'
}

function isAlignment(feature: Feature<MapProps>): feature is AlignmentFeature {
  return feature.properties.kind === 'ALIGNMENT'
}

function isCorridor(feature: Feature<MapProps>): feature is CorridorFeature {
  return feature.properties.kind === 'CORRIDOR'
}

export function parcelTitle(props: Extract<MapProps, { kind: 'PARCEL' }>): string {
  const identifier = props.gatNumber ?? props.surveyNumber
  return identifier ? `Gat ${identifier}` : `Parcel ${shortId(props.parcelId)}`
}

export function parcelAriaLabel(props: Extract<MapProps, { kind: 'PARCEL' }>): string {
  const parts = [
    parcelTitle(props),
    LAND_CLASSIFICATION_LABELS[props.classification],
    `${props.areaHa} ha`,
    props.inCase ? 'in an acquisition case' : 'not in an acquisition case',
  ]
  if (props.landUse === 'WATER_BODY') {
    parts.push('water body')
  }
  return parts.join(', ')
}

/** A pattern or tag for parcels whose meaning must not rely on colour alone. */
function parcelTag(props: Extract<MapProps, { kind: 'PARCEL' }>): string | null {
  if (props.landUse === 'WATER_BODY') {
    return 'Water'
  }
  if (props.classification === 'FOREST') {
    return 'Forest'
  }
  if (props.classification === 'GOVERNMENT') {
    return 'Govt'
  }
  return null
}

function parcelPatternId(
  props: Extract<MapProps, { kind: 'PARCEL' }>,
  uid: string,
): string | null {
  if (props.landUse === 'WATER_BODY') {
    return `${uid}-water`
  }
  if (props.classification === 'FOREST') {
    return `${uid}-forest`
  }
  if (props.classification === 'GOVERNMENT') {
    return `${uid}-government`
  }
  return null
}

function centroid(geometry: Feature<MapProps>['geometry'], projection: Projection) {
  const positions = geometryPositions(geometry)
  if (positions.length === 0) {
    return null
  }
  const sum = positions.reduce(
    (total, position) => {
      const point = projection.project(position)
      return { x: total.x + point.x, y: total.y + point.y }
    },
    { x: 0, y: 0 },
  )
  return { x: sum.x / positions.length, y: sum.y / positions.length }
}

function handleKey(event: KeyboardEvent<SVGPathElement>, select: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    select()
  }
}

export function GeoJsonSvg({
  data,
  height = DEFAULT_HEIGHT,
  selectedParcelId = null,
  onSelectParcel,
  label = 'Map drawn from officer-entered GeoJSON. No base map and no external tiles.',
}: GeoJsonSvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [zoom, setZoom] = useState(1)
  const [layers, setLayers] = useState<Layers>({
    corridor: true,
    parcels: true,
    alignment: true,
  })

  const parcels = useMemo(() => data.features.filter(isParcel), [data.features])
  const alignment = useMemo(
    () => data.features.filter(isAlignment),
    [data.features],
  )
  const corridor = useMemo(() => data.features.filter(isCorridor), [data.features])

  const positions = useMemo(
    () => data.features.flatMap((feature) => geometryPositions(feature.geometry)),
    [data.features],
  )

  const projection = useMemo(
    () => createProjection(positions, { width: WIDTH, height, padding: 32 }),
    [positions, height],
  )

  const scaleBar = niceScaleBar(projection.metresPerPixel / zoom)
  const centreX = WIDTH / 2
  const centreY = height / 2
  const scaleBarY = height - 24

  if (data.features.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
        No map shapes are available. Enter a boundary or an alignment first.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="sr-only">Map layers</legend>
          {(
            [
              ['corridor', 'Corridor'],
              ['parcels', 'Parcels'],
              ['alignment', 'Alignment'],
            ] as const
          ).map(([key, text]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={layers[key]}
                onChange={(event) =>
                  setLayers((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
              {text}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom((current) => Math.min(current * 1.5, 8))}
            leftIcon={<ZoomIn aria-hidden="true" className="h-4 w-4" />}
          >
            Zoom in
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom((current) => Math.max(current / 1.5, 0.5))}
            leftIcon={<ZoomOut aria-hidden="true" className="h-4 w-4" />}
          >
            Zoom out
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(1)}
            leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
          >
            Reset zoom
          </Button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={label}
        className="h-auto w-full rounded-lg border border-slate-200 bg-slate-50"
      >
        <defs>
          <pattern
            id={`${uid}-forest`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="10" height="10" fill="#dcfce7" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#15803d" strokeWidth="2" />
          </pattern>
          <pattern id={`${uid}-water`} width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#dbeafe" />
            <circle cx="3" cy="3" r="1.4" fill="#1d4ed8" />
            <circle cx="8" cy="8" r="1.4" fill="#1d4ed8" />
          </pattern>
          <pattern
            id={`${uid}-government`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <rect width="10" height="10" fill="#f1f5f9" />
            <path d="M 0 0 L 10 10 M 10 0 L 0 10" stroke="#475569" strokeWidth="1" />
          </pattern>
          <marker
            id={`${uid}-arrow`}
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1e293b" />
          </marker>
        </defs>

        <g
          transform={`translate(${centreX} ${centreY}) scale(${zoom}) translate(${-centreX} ${-centreY})`}
        >
          {layers.corridor
            ? corridor.map((feature, index) => (
                <path
                  key={`corridor-${index}`}
                  d={geometryToPath(feature.geometry, projection)}
                  fill="#fef3c7"
                  fillOpacity={0.55}
                  stroke="#d97706"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  data-layer="corridor"
                />
              ))
            : null}

          {layers.parcels
            ? parcels.map((feature) => {
                const props = feature.properties
                const patternId = parcelPatternId(props, uid)
                const tag = parcelTag(props)
                const selected = props.parcelId === selectedParcelId
                const point = centroid(feature.geometry, projection)
                const title = parcelTitle(props)
                const select = () => onSelectParcel?.(props.parcelId)

                return (
                  <g key={props.parcelId}>
                    <path
                      d={geometryToPath(feature.geometry, projection)}
                      fillRule="evenodd"
                      fill={patternId ? `url(#${patternId})` : '#bfdbfe'}
                      fillOpacity={patternId ? 1 : 0.45}
                      stroke={selected ? '#b91c1c' : '#1e40af'}
                      strokeWidth={selected ? 3 : 1.25}
                      strokeDasharray={props.inCase ? undefined : '4 3'}
                      tabIndex={0}
                      role="button"
                      aria-label={parcelAriaLabel(props)}
                      aria-pressed={selected}
                      className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      onClick={select}
                      onFocus={select}
                      onKeyDown={(event) => handleKey(event, select)}
                      data-parcel-id={props.parcelId}
                    >
                      <title>{`${title} · ${LAND_CLASSIFICATION_LABELS[props.classification]} · ${props.areaHa} ha`}</title>
                    </path>
                    {point ? (
                      <g pointerEvents="none" aria-hidden="true">
                        <text
                          x={point.x}
                          y={point.y - (tag ? 2 : 0)}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={600}
                          fill="#0f172a"
                        >
                          {title}
                        </text>
                        {tag ? (
                          <text
                            x={point.x}
                            y={point.y + 12}
                            textAnchor="middle"
                            fontSize={9}
                            fontWeight={700}
                            fill="#0f172a"
                          >
                            {tag}
                          </text>
                        ) : null}
                      </g>
                    ) : null}
                  </g>
                )
              })
            : null}

          {layers.alignment
            ? alignment.map((feature, index) => (
                <path
                  key={`alignment-${index}`}
                  d={geometryToPath(feature.geometry, projection)}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  markerEnd={`url(#${uid}-arrow)`}
                  data-layer="alignment"
                />
              ))
            : null}
        </g>

        <g aria-hidden="true">
          <line
            x1={24}
            y1={scaleBarY}
            x2={24 + scaleBar.pixels}
            y2={scaleBarY}
            stroke="#0f172a"
            strokeWidth={2}
          />
          <line x1={24} y1={scaleBarY - 5} x2={24} y2={scaleBarY + 5} stroke="#0f172a" strokeWidth={2} />
          <line
            x1={24 + scaleBar.pixels}
            y1={scaleBarY - 5}
            x2={24 + scaleBar.pixels}
            y2={scaleBarY + 5}
            stroke="#0f172a"
            strokeWidth={2}
          />
          <text x={24} y={scaleBarY - 9} fontSize={11} fill="#0f172a">
            {scaleBar.label}
          </text>
        </g>

        <g aria-hidden="true" transform={`translate(${WIDTH - 46} 26)`}>
          <polygon points="0,-16 8,10 0,5 -8,10" fill="#0f172a" />
          <text x={0} y={26} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">
            N
          </text>
        </g>
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>No base map: shapes are drawn from officer-entered data only.</p>
        <p>
          {parcels.length} parcel{parcels.length === 1 ? '' : 's'} · alignment{' '}
          {alignment.length > 0 ? 'recorded' : 'not recorded'} · corridor{' '}
          {corridor.length > 0 ? 'recorded' : 'not recorded'}
        </p>
      </div>

      <div className="sr-only">
        <table>
          <caption>Parcels shown on the map</caption>
          <thead>
            <tr>
              <th scope="col">Parcel</th>
              <th scope="col">Classification</th>
              <th scope="col">Land use</th>
              <th scope="col">Area</th>
              <th scope="col">In case</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((feature) => (
              <tr key={feature.properties.parcelId}>
                <td>{parcelTitle(feature.properties)}</td>
                <td>{LAND_CLASSIFICATION_LABELS[feature.properties.classification]}</td>
                <td>{LAND_USE_LABELS[feature.properties.landUse]}</td>
                <td>{feature.properties.areaHa} ha</td>
                <td>{feature.properties.inCase ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
