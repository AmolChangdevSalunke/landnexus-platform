import type { Geometry } from '../../api/types'
import { geometryPositions } from './projection'

export const MAX_GEOMETRY_CHARS = 1_000_000

export type GeometryKind = 'polygon' | 'line'

export interface GeometryParseResult {
  geometry: Geometry | null
  errors: string[]
  warnings: string[]
  /** A note when a Feature or a single-feature FeatureCollection was unwrapped. */
  unwrapped: string | null
}

const POLYGON_TYPES = ['Polygon', 'MultiPolygon']
const LINE_TYPES = ['LineString', 'MultiLineString']
const ALL_TYPES = [...POLYGON_TYPES, ...LINE_TYPES]

/** India's rough bounding box, used only as a paste-time warning. */
export function looksInsideIndia(position: number[]): boolean {
  return position[0] >= 68 && position[0] <= 97.5 && position[1] >= 6 && position[1] <= 37.6
}

/**
 * GeoJSON is [longitude, latitude]. A point with the two values exchanged can
 * still look plausible, so this checks whether the swapped pair falls inside
 * India while the original pair does not.
 */
export function looksSwapped(position: number[]): boolean {
  if (looksInsideIndia(position)) {
    return false
  }
  return looksInsideIndia([position[1], position[0]])
}

function expectedTypeLabel(kind: GeometryKind): string {
  return kind === 'polygon' ? 'a Polygon or MultiPolygon' : 'a LineString or MultiLineString'
}

function allowedTypes(kind: GeometryKind): string[] {
  return kind === 'polygon' ? POLYGON_TYPES : LINE_TYPES
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Parse and pre-check a pasted or uploaded GeoJSON value.
 *
 * The backend remains the authority: these checks only avoid an obviously
 * wrong request and make the preview possible. Any server 400 is shown
 * verbatim by the entry form.
 */
export function parseGeometryInput(
  raw: string,
  kind: GeometryKind,
): GeometryParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  let unwrapped: string | null = null

  if (!raw.trim()) {
    return {
      geometry: null,
      errors: ['Paste a GeoJSON geometry or choose a .geojson/.json file.'],
      warnings,
      unwrapped,
    }
  }

  if (raw.length > MAX_GEOMETRY_CHARS) {
    return {
      geometry: null,
      errors: [
        `The GeoJSON text is too long (${raw.length.toLocaleString('en-IN')} characters). The limit is ${MAX_GEOMETRY_CHARS.toLocaleString('en-IN')} characters.`,
      ],
      warnings,
      unwrapped,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      geometry: null,
      errors: ['The text is not valid JSON.'],
      warnings,
      unwrapped,
    }
  }

  if (!isRecord(parsed)) {
    return {
      geometry: null,
      errors: ['The JSON must be a GeoJSON geometry object.'],
      warnings,
      unwrapped,
    }
  }

  let candidate: unknown = parsed
  if (parsed.type === 'Feature') {
    candidate = parsed.geometry
    unwrapped =
      'The Feature was unwrapped and only its geometry will be sent, as the API requires a bare geometry.'
  } else if (parsed.type === 'FeatureCollection') {
    const features = parsed.features
    if (!Array.isArray(features) || features.length !== 1) {
      return {
        geometry: null,
        errors: [
          'A FeatureCollection is accepted only when it contains exactly one Feature. Use a single geometry instead.',
        ],
        warnings,
        unwrapped,
      }
    }
    const onlyFeature = features[0]
    candidate = isRecord(onlyFeature) ? onlyFeature.geometry : null
    unwrapped =
      'The single-feature FeatureCollection was unwrapped and only its geometry will be sent, as the API requires a bare geometry.'
  }

  if (!isRecord(candidate)) {
    return {
      geometry: null,
      errors: ['No geometry object was found in the JSON.'],
      warnings,
      unwrapped,
    }
  }

  const type = candidate.type
  if (typeof type !== 'string' || !ALL_TYPES.includes(type)) {
    return {
      geometry: null,
      errors: [
        `Expected ${expectedTypeLabel(kind)}. Received ${typeof type === 'string' ? type : 'no geometry type'}.`,
      ],
      warnings,
      unwrapped,
    }
  }

  if (!allowedTypes(kind).includes(type)) {
    return {
      geometry: null,
      errors: [`Expected ${expectedTypeLabel(kind)}. Received ${type}.`],
      warnings,
      unwrapped,
    }
  }

  if (!Array.isArray(candidate.coordinates)) {
    return {
      geometry: null,
      errors: ['The geometry has no coordinates array.'],
      warnings,
      unwrapped,
    }
  }

  const geometry: Geometry = {
    type: type as Geometry['type'],
    coordinates: candidate.coordinates,
  }
  const positions = geometryPositions(geometry)

  if (positions.length === 0) {
    return {
      geometry: null,
      errors: ['The geometry has no usable [longitude, latitude] positions.'],
      warnings,
      unwrapped,
    }
  }

  const first = positions[0]
  if (looksSwapped(first)) {
    warnings.push(
      'The first coordinate looks swapped. GeoJSON uses [longitude, latitude], for example [73.85, 18.52].',
    )
  } else if (!looksInsideIndia(first)) {
    warnings.push(
      'The first coordinate does not look like a point inside India (longitude 68 to 97.5, latitude 6 to 37.6). Check that longitude comes first.',
    )
  }

  if (positions.some((position) => position.length > 2)) {
    warnings.push(
      'A coordinate has an elevation value. Send only [longitude, latitude]; the server rejects elevation values.',
    )
  }

  if (kind === 'polygon' && (type === 'Polygon' || type === 'MultiPolygon')) {
    const rings =
      type === 'Polygon'
        ? (geometry.coordinates as unknown[])
        : (geometry.coordinates as unknown[]).flatMap((polygon) =>
            Array.isArray(polygon) ? polygon : [],
          )
    const shortRing = rings.some(
      (ring) => !Array.isArray(ring) || geometryPositions({ type: 'LineString', coordinates: ring }).length < 4,
    )
    if (shortRing) {
      warnings.push(
        'A polygon ring needs at least four positions and a closed ring. The server will reject an invalid ring.',
      )
    }
  }

  return { geometry, errors, warnings, unwrapped }
}

/** Read a .geojson/.json file in the browser. Nothing is uploaded automatically. */
export async function readGeometryFile(file: File): Promise<string> {
  return file.text()
}
