import { apiClient } from './client'
import type {
  BhuvanHistoryPage,
  BhuvanLulcAnalysis,
  BhuvanStatus,
  BhuvanVillageResult,
} from './types'
import { filenameFromContentDisposition } from '../utils/download'

/** The Bhuvan token is added by the backend; nothing here can expose it. */
export async function getBhuvanStatus(): Promise<BhuvanStatus> {
  const { data } = await apiClient.get<BhuvanStatus>('/gis/bhuvan/status')
  return data
}

export interface LulcAoiRequest {
  projectId?: string
  wkt?: string
}

export async function runBhuvanLulc(request: LulcAoiRequest): Promise<BhuvanLulcAnalysis> {
  const { data } = await apiClient.post<BhuvanLulcAnalysis>('/gis/bhuvan/lulc/aoi', {
    projectId: request.projectId || null,
    wkt: request.wkt?.trim() || null,
  })
  return data
}

export async function getBhuvanHistory(
  projectId?: string,
  page = 0,
  size = 20,
): Promise<BhuvanHistoryPage> {
  const { data } = await apiClient.get<BhuvanHistoryPage>('/gis/bhuvan/history', {
    params: { projectId: projectId || undefined, page, size },
  })
  return data
}

export async function getBhuvanAnalysis(id: string): Promise<BhuvanLulcAnalysis> {
  const { data } = await apiClient.get<BhuvanLulcAnalysis>(`/gis/bhuvan/history/${id}`)
  return data
}

async function exportFile(id: string, format: 'csv' | 'pdf') {
  const response = await apiClient.get<Blob>(`/gis/bhuvan/history/${id}/export.${format}`, {
    responseType: 'blob',
  })
  return {
    blob: response.data,
    filename: filenameFromContentDisposition(
      response.headers['content-disposition'] as string | undefined,
      `bhuvan-lulc-${id}.${format}`,
    ),
  }
}

export function exportBhuvanCsv(id: string) {
  return exportFile(id, 'csv')
}

export function exportBhuvanPdf(id: string) {
  return exportFile(id, 'pdf')
}

export async function geocodeBhuvanVillage(
  village: string,
  stateCode?: string,
): Promise<BhuvanVillageResult> {
  const { data } = await apiClient.get<BhuvanVillageResult>('/gis/bhuvan/villages/geocode', {
    params: { village: village.trim(), stateCode: stateCode || undefined },
  })
  return data
}

export async function reverseGeocodeBhuvanVillage(
  lat: number,
  lon: number,
  stateCode?: string,
): Promise<BhuvanVillageResult> {
  const { data } = await apiClient.get<BhuvanVillageResult>('/gis/bhuvan/villages/reverse', {
    params: { lat, lon, stateCode: stateCode || undefined },
  })
  return data
}
