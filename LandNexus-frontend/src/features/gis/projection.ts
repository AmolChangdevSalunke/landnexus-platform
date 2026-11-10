import type { Geometry } from '../../api/types'

export interface Point {
  x: number
  y: number
}

export interface Viewport {
  width: number
  height: number
  padding?: number
}

export interface Projection {
  /** Longitude/latitude to SVG pixel coordinates. */
  project: (position: number[]) => Point
  /** Metres represented by one SVG pixel at the centre latitude. */
  metresPerPixel: number
}

export interface ScaleBar {
  metres: number
  pixels: number
  label: string
}

const METRES_PER_DEGREE = 111_320

function isPosition(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

/** Every [lon, lat] position inside any supported GeoJSON geometry. */
export function geometryPositions(geometry: Geometry): number[][] {
  const positions: number[][] = []

  function walk(value: unknown) {
    if (isPosition(value)) {
      positions.push([value[0], value[1]])
      return
    }
    if (Array.isArray(value)) {
      value.forEach(walk)
    }
  }

  walk(geometry.coordinates)
  return positions
}

export interface Bounds {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

/** Axis-aligned WGS84 bounding box of every position in the geometry. */
export function geometryBounds(geometry: Geometry): Bounds | null {
  const positions = geometryPositions(geometry)
  if (positions.length === 0) {
    return null
  }

  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  positions.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  })

  return { minLon, minLat, maxLon, maxLat }
}

/**
 * Equirectangular projection with a latitude correction.
 *
 * `x = (lon - lon0) * cos(lat0)` and `y = -(lat - lat0)`, fitted into the
 * viewport with padding. Longitude and latitude are treated as WGS84 degrees.
 * No tile server and no external data are involved.
 */
export function createProjection(
  positions: number[][],
  viewport: Viewport,
): Projection {
  const padding = viewport.padding ?? 24
  const usableWidth = Math.max(viewport.width - padding * 2, 1)
  const usableHeight = Math.max(viewport.height - padding * 2, 1)

  if (positions.length === 0) {
    return {
      project: () => ({ x: viewport.width / 2, y: viewport.height / 2 }),
      metresPerPixel: METRES_PER_DEGREE,
    }
  }

  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  positions.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  })

  const lon0 = (minLon + maxLon) / 2
  const lat0 = (minLat + maxLat) / 2
  const cosLat = Math.cos((lat0 * Math.PI) / 180)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  positions.forEach(([lon, lat]) => {
    const x = (lon - lon0) * cosLat
    const y = -(lat - lat0)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  })

  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const scale = Math.min(usableWidth / spanX, usableHeight / spanY)
  const offsetX = padding + (usableWidth - spanX * scale) / 2 - minX * scale
  const offsetY = padding + (usableHeight - spanY * scale) / 2 - minY * scale

  return {
    project: ([lon, lat]) => ({
      x: (lon - lon0) * cosLat * scale + offsetX,
      y: -(lat - lat0) * scale + offsetY,
    }),
    // One projected x-unit is one degree of latitude in metres.
    metresPerPixel: METRES_PER_DEGREE / scale,
  }
}

/** A short, round scale-bar length close to the target pixel width. */
export function niceScaleBar(metresPerPixel: number, targetPixels = 120): ScaleBar {
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0) {
    return { metres: 0, pixels: 0, label: '—' }
  }

  const rawMetres = metresPerPixel * targetPixels
  const power = Math.pow(10, Math.floor(Math.log10(rawMetres)))
  const normalised = rawMetres / power
  const nice = normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1
  const metres = nice * power
  const pixels = metres / metresPerPixel
  const label =
    metres >= 1000
      ? `${Number((metres / 1000).toFixed(2))} km`
      : `${Number(metres.toFixed(1))} m`

  return { metres, pixels, label }
}

function ringPath(ring: unknown, projection: Projection): string {
  if (!Array.isArray(ring)) {
    return ''
  }
  const points = ring.filter(isPosition).map((position) => projection.project(position))
  if (points.length === 0) {
    return ''
  }
  const [first, ...rest] = points
  return (
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ` +
    rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ') +
    ' Z'
  )
}

function linePath(line: unknown, projection: Projection): string {
  if (!Array.isArray(line)) {
    return ''
  }
  const points = line.filter(isPosition).map((position) => projection.project(position))
  if (points.length === 0) {
    return ''
  }
  const [first, ...rest] = points
  return (
    `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ` +
    rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  )
}

/**
 * SVG path data for a Polygon, MultiPolygon, LineString or MultiLineString.
 * Polygon rings are closed and can be drawn with `fill-rule="evenodd"`.
 */
export function geometryToPath(geometry: Geometry, projection: Projection): string {
  const coordinates = geometry.coordinates
  if (!Array.isArray(coordinates)) {
    return ''
  }

  switch (geometry.type) {
    case 'Polygon':
      return coordinates.map((ring) => ringPath(ring, projection)).filter(Boolean).join(' ')
    case 'MultiPolygon':
      return coordinates
        .flatMap((polygon) => (Array.isArray(polygon) ? polygon : []))
        .map((ring) => ringPath(ring, projection))
        .filter(Boolean)
        .join(' ')
    case 'LineString':
      return linePath(coordinates, projection)
    case 'MultiLineString':
      return coordinates
        .map((line) => linePath(line, projection))
        .filter(Boolean)
        .join(' ')
    default:
      return ''
  }
}
