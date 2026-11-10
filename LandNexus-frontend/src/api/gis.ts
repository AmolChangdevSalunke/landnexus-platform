import axios from 'axios'
import { apiClient } from './client'
import type {
  AlignmentFeatureProps,
  AlignmentResponse,
  AlignmentVersion,
  BoundaryFeatureProps,
  BoundaryResponse,
  BoundaryVersion,
  ConflictReport,
  CorridorFeatureProps,
  Feature,
  FeatureCollection,
  Geometry,
  ImageryStatus,
  ImageryTestResult,
  MapProps,
} from './types'

/* ------------------------------------------------------------------ */
/* Parcel boundaries                                                   */
/* ------------------------------------------------------------------ */

/** The request body is ONE bare GeoJSON geometry, never a Feature. */
export async function setParcelBoundary(
  parcelId: string,
  geometry: Geometry,
  sourceNote?: string,
): Promise<BoundaryResponse> {
  const { data } = await apiClient.put<BoundaryResponse>(
    `/gis/parcels/${parcelId}/boundary`,
    geometry,
    { params: { sourceNote: sourceNote?.trim() || undefined } },
  )
  return data
}

/** Returns the current boundary Feature. A parcel without a boundary gives 404. */
export async function getParcelBoundary(
  parcelId: string,
): Promise<Feature<BoundaryFeatureProps>> {
  const { data } = await apiClient.get<Feature<BoundaryFeatureProps>>(
    `/gis/parcels/${parcelId}/boundary`,
  )
  return data
}

export async function getParcelBoundaryHistory(
  parcelId: string,
): Promise<BoundaryVersion[]> {
  const { data } = await apiClient.get<BoundaryVersion[]>(
    `/gis/parcels/${parcelId}/boundary/history`,
  )
  return data
}

export async function getVillageParcels(
  villageId: string,
): Promise<FeatureCollection<MapProps>> {
  const { data } = await apiClient.get<FeatureCollection<MapProps>>(
    `/gis/villages/${villageId}/parcels`,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Project alignment and corridor                                      */
/* ------------------------------------------------------------------ */

/** The request body is ONE bare GeoJSON LineString or MultiLineString. */
export async function setProjectAlignment(
  projectId: string,
  geometry: Geometry,
  corridorWidthM: number,
  sourceNote?: string,
): Promise<AlignmentResponse> {
  const { data } = await apiClient.put<AlignmentResponse>(
    `/gis/projects/${projectId}/alignment`,
    geometry,
    {
      params: {
        corridorWidthM,
        sourceNote: sourceNote?.trim() || undefined,
      },
    },
  )
  return data
}

export async function getProjectAlignment(
  projectId: string,
): Promise<Feature<AlignmentFeatureProps>> {
  const { data } = await apiClient.get<Feature<AlignmentFeatureProps>>(
    `/gis/projects/${projectId}/alignment`,
  )
  return data
}

export async function getProjectCorridor(
  projectId: string,
): Promise<Feature<CorridorFeatureProps>> {
  const { data } = await apiClient.get<Feature<CorridorFeatureProps>>(
    `/gis/projects/${projectId}/corridor`,
  )
  return data
}

export async function getProjectAlignmentHistory(
  projectId: string,
): Promise<AlignmentVersion[]> {
  const { data } = await apiClient.get<AlignmentVersion[]>(
    `/gis/projects/${projectId}/alignment/history`,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Map and conflict report                                             */
/* ------------------------------------------------------------------ */

/** Corridor, alignment and the parcels that cross it. No tiles, no external URLs. */
export async function getProjectMap(
  projectId: string,
): Promise<FeatureCollection<MapProps>> {
  const { data } = await apiClient.get<FeatureCollection<MapProps>>(
    `/gis/projects/${projectId}/map`,
  )
  return data
}

/** 404 when the project has no alignment yet. */
export async function getProjectConflicts(
  projectId: string,
): Promise<ConflictReport> {
  const { data } = await apiClient.get<ConflictReport>(
    `/gis/projects/${projectId}/conflicts`,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Satellite imagery (server-proxied WMS pictures)                     */
/* ------------------------------------------------------------------ */

/** GET /gis/imagery/status — a summary only; the provider URL never reaches the browser. */
export async function getImageryStatus(): Promise<ImageryStatus> {
  const { data } = await apiClient.get<ImageryStatus>('/gis/imagery/status')
  return data
}

export interface ImageryMapParams {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
  /** 64 to 1024; the server clamps to this range. */
  width?: number
  height?: number
  layer?: 'imagery' | 'overlay'
}

/**
 * GET /gis/imagery/map — one satellite picture for a bounding box inside India
 * (at most 5 degrees on a side), fetched as a blob because the request needs
 * the Authorization header. Error bodies are small JSON objects; axios would
 * hand them over as blobs, so they are unpacked before toApiErrorInfo runs.
 */
export async function getImageryMap(params: ImageryMapParams): Promise<Blob> {
  const { minLon, minLat, maxLon, maxLat, width, height, layer } = params
  try {
    const { data } = await apiClient.get<Blob>('/gis/imagery/map', {
      params: {
        bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
        width,
        height,
        layer,
      },
      responseType: 'blob',
    })
    return data
  } catch (caught) {
    throw await unwrapBlobErrorBody(caught)
  }
}

/** POST /gis/imagery/test — asks the provider for a tiny picture and reports the outcome. */
export async function testImagery(): Promise<ImageryTestResult> {
  const { data } = await apiClient.post<ImageryTestResult>('/gis/imagery/test')
  return data
}

async function unwrapBlobErrorBody(caught: unknown): Promise<unknown> {
  if (axios.isAxiosError(caught) && caught.response) {
    const body: unknown = caught.response.data
    if (body instanceof Blob && body.type.includes('json')) {
      try {
        caught.response.data = JSON.parse(await body.text())
      } catch {
        // Keep the original error; toApiErrorInfo falls back to its own message.
      }
    }
  }
  return caught
}
