import { apiClient } from './client'
import type {
  DocumentCategory,
  DocumentResponse,
  LandownerRequest,
  LandownerResponse,
  LandownerSummary,
  MutationRequest,
  MutationResponse,
  OwnershipEndRequest,
  OwnershipRequest,
  OwnershipResponse,
  PageResponse,
  ParcelRequest,
  ParcelResponse,
  RecordStatus,
  RevenueRecordRequest,
  RevenueRecordResponse,
} from './types'

export interface ParcelListParams {
  districtId?: string
  villageId?: string
  /** Gat or survey number; the backend matches either. */
  number?: string
  page?: number
  size?: number
}

export interface LandownerListParams {
  districtId?: string
  name?: string
  page?: number
  size?: number
}

export async function getParcels({
  districtId,
  villageId,
  number,
  page = 0,
  size = 20,
}: ParcelListParams): Promise<PageResponse<ParcelResponse>> {
  const { data } = await apiClient.get<PageResponse<ParcelResponse>>('/land-records/parcels', {
    params: {
      districtId: districtId || undefined,
      villageId: villageId || undefined,
      number: number || undefined,
      page,
      size,
    },
  })
  return data
}

export async function getParcel(id: string): Promise<ParcelResponse> {
  const { data } = await apiClient.get<ParcelResponse>(`/land-records/parcels/${id}`)
  return data
}

export async function createParcel(request: ParcelRequest): Promise<ParcelResponse> {
  const { data } = await apiClient.post<ParcelResponse>('/land-records/parcels', request)
  return data
}

export async function updateParcel(
  id: string,
  request: ParcelRequest,
): Promise<ParcelResponse> {
  const { data } = await apiClient.put<ParcelResponse>(`/land-records/parcels/${id}`, request)
  return data
}

/** Parcels are never deleted; they are activated or deactivated. */
export async function setParcelStatus(
  id: string,
  status: RecordStatus,
): Promise<ParcelResponse> {
  const action = status === 'ACTIVE' ? 'activate' : 'deactivate'
  const { data } = await apiClient.post<ParcelResponse>(
    `/land-records/parcels/${id}/${action}`,
  )
  return data
}

export async function getLandowners({
  districtId,
  name,
  page = 0,
  size = 20,
}: LandownerListParams): Promise<PageResponse<LandownerSummary>> {
  const { data } = await apiClient.get<PageResponse<LandownerSummary>>(
    '/land-records/landowners',
    {
      params: {
        districtId: districtId || undefined,
        name: name || undefined,
        page,
        size,
      },
    },
  )
  return data
}

export async function getLandowner(id: string): Promise<LandownerResponse> {
  const { data } = await apiClient.get<LandownerResponse>(`/land-records/landowners/${id}`)
  return data
}

export async function createLandowner(
  request: LandownerRequest,
): Promise<LandownerResponse> {
  const { data } = await apiClient.post<LandownerResponse>(
    '/land-records/landowners',
    request,
  )
  return data
}

export async function updateLandowner(
  id: string,
  request: LandownerRequest,
): Promise<LandownerResponse> {
  const { data } = await apiClient.put<LandownerResponse>(
    `/land-records/landowners/${id}`,
    request,
  )
  return data
}

export async function getOwnerships(parcelId: string): Promise<OwnershipResponse[]> {
  const { data } = await apiClient.get<OwnershipResponse[]>(
    `/land-records/parcels/${parcelId}/ownerships`,
  )
  return data
}

export async function addOwnership(
  parcelId: string,
  request: OwnershipRequest,
): Promise<OwnershipResponse> {
  const { data } = await apiClient.post<OwnershipResponse>(
    `/land-records/parcels/${parcelId}/ownerships`,
    request,
  )
  return data
}

export async function endOwnership(
  parcelId: string,
  ownershipId: string,
  request: OwnershipEndRequest,
): Promise<OwnershipResponse> {
  const { data } = await apiClient.post<OwnershipResponse>(
    `/land-records/parcels/${parcelId}/ownerships/${ownershipId}/end`,
    request,
  )
  return data
}

export async function getMutations(parcelId: string): Promise<MutationResponse[]> {
  const { data } = await apiClient.get<MutationResponse[]>(
    `/land-records/parcels/${parcelId}/mutations`,
  )
  return data
}

export async function addMutation(
  parcelId: string,
  request: MutationRequest,
): Promise<MutationResponse> {
  const { data } = await apiClient.post<MutationResponse>(
    `/land-records/parcels/${parcelId}/mutations`,
    request,
  )
  return data
}

export async function getRevenueRecords(
  parcelId: string,
): Promise<RevenueRecordResponse[]> {
  const { data } = await apiClient.get<RevenueRecordResponse[]>(
    `/land-records/parcels/${parcelId}/revenue-records`,
  )
  return data
}

export async function addRevenueRecord(
  parcelId: string,
  request: RevenueRecordRequest,
): Promise<RevenueRecordResponse> {
  const { data } = await apiClient.post<RevenueRecordResponse>(
    `/land-records/parcels/${parcelId}/revenue-records`,
    request,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type UploadProgressHandler = (percent: number) => void

function uploadProgress(handler?: UploadProgressHandler) {
  if (!handler) {
    return undefined
  }
  return (event: { loaded: number; total?: number }) => {
    if (!event.total) {
      return
    }
    handler(Math.round((event.loaded / event.total) * 100))
  }
}

/**
 * Uploads a new document. The browser must set the multipart boundary itself,
 * so no Content-Type header is passed here.
 */
export async function uploadParcelDocument(
  parcelId: string,
  input: { file: File; category: DocumentCategory; title: string },
  onProgress?: UploadProgressHandler,
): Promise<DocumentResponse> {
  const formData = new FormData()
  formData.append('file', input.file)
  formData.append('category', input.category)
  formData.append('title', input.title)

  const { data } = await apiClient.post<DocumentResponse>(
    `/land-records/parcels/${parcelId}/documents`,
    formData,
    { onUploadProgress: uploadProgress(onProgress) },
  )
  return data
}

/** Adds a new version. Verification returns to PENDING on the backend. */
export async function uploadDocumentVersion(
  documentId: string,
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<DocumentResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<DocumentResponse>(
    `/land-records/documents/${documentId}/versions`,
    formData,
    { onUploadProgress: uploadProgress(onProgress) },
  )
  return data
}

export async function getParcelDocuments(parcelId: string): Promise<DocumentResponse[]> {
  const { data } = await apiClient.get<DocumentResponse[]>(
    `/land-records/parcels/${parcelId}/documents`,
  )
  return data
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const { data } = await apiClient.get<DocumentResponse>(`/land-records/documents/${id}`)
  return data
}

function filenameFromDisposition(
  disposition: string | undefined,
  fallback: string,
): string {
  if (!disposition) {
    return fallback
  }

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim())
    } catch {
      return fallback
    }
  }

  const quoted = /filename="?([^";]+)"?/i.exec(disposition)
  return quoted?.[1]?.trim() || fallback
}

/**
 * Downloads one document version through the shared authenticated client.
 * The caller turns the returned blob into a temporary object URL; the file is
 * never embedded or opened inline.
 */
export async function downloadDocumentVersion(
  documentId: string,
  versionNo: number,
  fallbackFilename = 'document',
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(
    `/land-records/documents/${documentId}/versions/${versionNo}/download`,
    { responseType: 'blob' },
  )

  return {
    blob: response.data,
    filename: filenameFromDisposition(
      response.headers['content-disposition'] as string | undefined,
      fallbackFilename,
    ),
  }
}

export async function verifyDocument(
  id: string,
  remarks?: string,
): Promise<DocumentResponse> {
  const trimmed = remarks?.trim()
  const { data } = await apiClient.post<DocumentResponse>(
    `/land-records/documents/${id}/verify`,
    trimmed ? { remarks: trimmed } : undefined,
  )
  return data
}

/** Rejecting a document requires remarks; the backend enforces the same rule. */
export async function rejectDocument(
  id: string,
  remarks: string,
): Promise<DocumentResponse> {
  const { data } = await apiClient.post<DocumentResponse>(
    `/land-records/documents/${id}/reject`,
    { remarks: remarks.trim() },
  )
  return data
}
