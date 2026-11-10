import { useEffect, useState } from 'react'
import { RotateCcw, Satellite } from 'lucide-react'
import { getImageryMap, getImageryStatus } from '../../api/gis'
import { toApiErrorInfo } from '../../api/errors'
import type { Geometry } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { geometryBounds } from './projection'

/* The same limits the backend imagery service enforces; the box is only
 * prepared here so an impossible request is never sent. */
const INDIA_MIN_LON = 68
const INDIA_MAX_LON = 97.5
const INDIA_MIN_LAT = 6
const INDIA_MAX_LAT = 37.6
const MAX_SPAN_DEGREES = 5
const PICTURE_WIDTH = 768
const PICTURE_HEIGHT = 512

type Box =
  | {
      status: 'ready'
      minLon: number
      minLat: number
      maxLon: number
      maxLat: number
    }
  | { status: 'no-geometry' }
  | { status: 'too-large' }
  | { status: 'outside-india' }

/** Pads the recorded geometry's bounding box so the shape is not at the edge. */
function satelliteBox(geometry: Geometry | null | undefined): Box {
  const bounds = geometry ? geometryBounds(geometry) : null
  if (!bounds) {
    return { status: 'no-geometry' }
  }

  if (
    bounds.minLon < INDIA_MIN_LON ||
    bounds.maxLon > INDIA_MAX_LON ||
    bounds.minLat < INDIA_MIN_LAT ||
    bounds.maxLat > INDIA_MAX_LAT
  ) {
    return { status: 'outside-india' }
  }

  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.002)
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.002)
  const padLon = Math.max(lonSpan * 0.15, 0.001)
  const padLat = Math.max(latSpan * 0.15, 0.001)

  const minLon = Math.max(bounds.minLon - padLon, INDIA_MIN_LON)
  const maxLon = Math.min(bounds.maxLon + padLon, INDIA_MAX_LON)
  const minLat = Math.max(bounds.minLat - padLat, INDIA_MIN_LAT)
  const maxLat = Math.min(bounds.maxLat + padLat, INDIA_MAX_LAT)

  if (maxLon - minLon > MAX_SPAN_DEGREES || maxLat - minLat > MAX_SPAN_DEGREES) {
    return { status: 'too-large' }
  }

  return { status: 'ready', minLon, minLat, maxLon, maxLat }
}

/**
 * A satellite picture of the recorded geometry's bounding box. The picture is
 * fetched through the LandNexus backend as a blob (the provider is never
 * contacted by the browser), and every failure degrades to a short note
 * instead of breaking the page around it.
 */
export function SatellitePreview({
  geometry,
  label,
}: {
  geometry: Geometry | null | undefined
  label: string
}) {
  const { can } = useAuth()
  const canRead = can(PERMISSION.GIS_READ)
  const statusQuery = useApiQuery(() => getImageryStatus(), [], canRead)

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [pictureError, setPictureError] = useState<string | null>(null)
  const [pictureLoading, setPictureLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const box = satelliteBox(geometry)
  const enabled = statusQuery.data?.enabled === true
  const attribution = statusQuery.data?.attribution?.trim() || null

  useEffect(() => {
    if (!canRead || !enabled || box.status !== 'ready') {
      return
    }

    let cancelled = false
    setPictureLoading(true)
    setPictureError(null)

    getImageryMap({
      minLon: box.minLon,
      minLat: box.minLat,
      maxLon: box.maxLon,
      maxLat: box.maxLat,
      width: PICTURE_WIDTH,
      height: PICTURE_HEIGHT,
    })
      .then((blob) => {
        if (cancelled) {
          return
        }
        const url = URL.createObjectURL(blob)
        setObjectUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous)
          }
          return url
        })
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setPictureError(toApiErrorInfo(caught).message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPictureLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, enabled, geometry, attempt])

  useEffect(
    () => () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    },
    [objectUrl],
  )

  if (!canRead) {
    return null
  }

  if (box.status === 'no-geometry') {
    return null
  }

  return (
    <Card className="p-4">
      <CardHeader
        title="Satellite picture"
        description="Served through the LandNexus backend for the recorded shape's bounding box."
        action={
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Satellite aria-hidden="true" className="h-3.5 w-3.5" />
            Server-side
          </span>
        }
      />

      <div className="mt-4">
        {!statusQuery.isLoading && statusQuery.error ? (
          <Alert variant="warning" title="Imagery status could not be loaded">
            {statusQuery.error.message} The drawn geometry remains available.
          </Alert>
        ) : statusQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !enabled ? (
          <Alert variant="info" title="Satellite imagery is not enabled">
            {statusQuery.data?.message ??
              'This server has no imagery provider configured.'}{' '}
            The drawn geometry above remains available.
          </Alert>
        ) : box.status === 'too-large' || box.status === 'outside-india' ? (
          <Alert variant="warning" title="Picture not available for this shape">
            The recorded shape covers a larger area than the satellite service
            allows (at most 5 degrees on a side inside India). The drawn
            geometry above remains available.
          </Alert>
        ) : pictureError ? (
          <Alert variant="warning" title="The picture could not be loaded">
            {pictureError} The drawn geometry above remains available.
          </Alert>
        ) : objectUrl ? (
          <figure className="space-y-2">
            <img
              src={objectUrl}
              alt={label}
              className="w-full rounded-lg border border-slate-200 bg-slate-100"
            />
            <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-mono">
                {box.minLon.toFixed(4)}, {box.minLat.toFixed(4)} ·{' '}
                {box.maxLon.toFixed(4)}, {box.maxLat.toFixed(4)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAttempt((current) => current + 1)}
                leftIcon={<RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />}
              >
                Reload picture
              </Button>
            </figcaption>
          </figure>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-48 w-full" />
            <p className="text-xs text-slate-500" aria-live="polite">
              {pictureLoading ? 'Loading the satellite picture…' : '…'}
            </p>
          </div>
        )}

        {enabled && attribution && objectUrl ? (
          <p className="mt-2 text-xs text-slate-500">Imagery: {attribution}</p>
        ) : null}
      </div>
    </Card>
  )
}
