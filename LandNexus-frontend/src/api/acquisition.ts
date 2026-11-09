import { apiClient } from './client'
import type {
  AcquisitionHistoryEntry,
  AwardResponse,
  CaseParcel,
  CaseRequest,
  CaseResponse,
  CaseStatus,
  DeclareAwardRequest,
  NoticeRequest,
  NoticeResponse,
  ObjectionRequest,
  ObjectionResponse,
  PageResponse,
  PhotoResponse,
  PossessionRequest,
  PossessionResponse,
  SurveyRequest,
  SurveyResponse,
  VerificationReport,
} from './types'

export interface CaseListParams {
  status?: CaseStatus
  districtId?: string
  projectId?: string
  page?: number
  size?: number
}

export async function getCases({
  status,
  districtId,
  projectId,
  page = 0,
  size = 20,
}: CaseListParams = {}): Promise<PageResponse<CaseResponse>> {
  const { data } = await apiClient.get<PageResponse<CaseResponse>>('/acquisition/cases', {
    params: {
      status: status || undefined,
      districtId: districtId || undefined,
      projectId: projectId || undefined,
      page,
      size,
    },
  })
  return data
}

export async function getCase(id: string): Promise<CaseResponse> {
  const { data } = await apiClient.get<CaseResponse>(`/acquisition/cases/${id}`)
  return data
}

export async function createCase(request: CaseRequest): Promise<CaseResponse> {
  const { data } = await apiClient.post<CaseResponse>('/acquisition/cases', request)
  return data
}

export async function getCaseHistory(id: string): Promise<AcquisitionHistoryEntry[]> {
  const { data } = await apiClient.get<AcquisitionHistoryEntry[]>(
    `/acquisition/cases/${id}/history`,
  )
  return data
}

export async function setCaseVillages(
  id: string,
  villageIds: string[],
): Promise<CaseResponse> {
  const { data } = await apiClient.put<CaseResponse>(`/acquisition/cases/${id}/villages`, {
    villageIds,
  })
  return data
}

export async function getCaseParcels(caseId: string): Promise<CaseParcel[]> {
  const { data } = await apiClient.get<CaseParcel[]>(
    `/acquisition/cases/${caseId}/parcels`,
  )
  return data
}

export async function identifyCaseParcel(
  caseId: string,
  request: { parcelId: string; areaToAcquireHa: number },
): Promise<CaseParcel> {
  const { data } = await apiClient.post<CaseParcel>(
    `/acquisition/cases/${caseId}/parcels`,
    request,
  )
  return data
}

export async function removeCaseParcel(
  caseId: string,
  caseParcelId: string,
): Promise<void> {
  await apiClient.delete(`/acquisition/cases/${caseId}/parcels/${caseParcelId}`)
}

export async function assignSurveyor(
  caseId: string,
  caseParcelId: string,
  surveyorUserId: string,
): Promise<CaseParcel> {
  const { data } = await apiClient.post<CaseParcel>(
    `/acquisition/cases/${caseId}/parcels/${caseParcelId}/assign`,
    { surveyorUserId },
  )
  return data
}

/** The authenticated field officer's worklist: parcels assigned to them in running cases. */
export async function getMyAssignments(): Promise<CaseParcel[]> {
  const { data } = await apiClient.get<CaseParcel[]>('/acquisition/my-assignments')
  return data
}

export async function getCaseSurveys(caseId: string): Promise<SurveyResponse[]> {
  const { data } = await apiClient.get<SurveyResponse[]>(
    `/acquisition/cases/${caseId}/surveys`,
  )
  return data
}

export async function submitSurvey(
  caseId: string,
  caseParcelId: string,
  request: SurveyRequest,
): Promise<SurveyResponse> {
  const { data } = await apiClient.post<SurveyResponse>(
    `/acquisition/cases/${caseId}/parcels/${caseParcelId}/surveys`,
    request,
  )
  return data
}

export async function verifySurvey(
  caseId: string,
  surveyId: string,
  remarks?: string,
): Promise<SurveyResponse> {
  const trimmed = remarks?.trim()
  const { data } = await apiClient.post<SurveyResponse>(
    `/acquisition/cases/${caseId}/surveys/${surveyId}/verify`,
    trimmed ? { remarks: trimmed } : undefined,
  )
  return data
}

/** Rejecting a survey requires remarks; the backend enforces the same rule. */
export async function rejectSurvey(
  caseId: string,
  surveyId: string,
  remarks: string,
): Promise<SurveyResponse> {
  const { data } = await apiClient.post<SurveyResponse>(
    `/acquisition/cases/${caseId}/surveys/${surveyId}/reject`,
    { remarks: remarks.trim() },
  )
  return data
}

export async function getVerificationReport(caseId: string): Promise<VerificationReport> {
  const { data } = await apiClient.get<VerificationReport>(
    `/acquisition/cases/${caseId}/verification-report`,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Survey photos                                                       */
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

/** Multipart upload; the browser must set the multipart boundary itself. */
export async function uploadSurveyPhoto(
  caseId: string,
  surveyId: string,
  input: {
    file: File
    latitude: number
    longitude: number
    capturedAt?: string
  },
  onProgress?: UploadProgressHandler,
): Promise<PhotoResponse> {
  const formData = new FormData()
  formData.append('file', input.file)
  formData.append('latitude', String(input.latitude))
  formData.append('longitude', String(input.longitude))
  if (input.capturedAt) {
    formData.append('capturedAt', input.capturedAt)
  }

  const { data } = await apiClient.post<PhotoResponse>(
    `/acquisition/cases/${caseId}/surveys/${surveyId}/photos`,
    formData,
    { onUploadProgress: uploadProgress(onProgress) },
  )
  return data
}

export async function getSurveyPhotos(
  caseId: string,
  surveyId: string,
): Promise<PhotoResponse[]> {
  const { data } = await apiClient.get<PhotoResponse[]>(
    `/acquisition/cases/${caseId}/surveys/${surveyId}/photos`,
  )
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

/** Authenticated blob download; the caller saves the blob and never embeds it. */
export async function downloadSurveyPhoto(
  caseId: string,
  surveyId: string,
  photoId: string,
  fallbackFilename = 'photo',
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(
    `/acquisition/cases/${caseId}/surveys/${surveyId}/photos/${photoId}/download`,
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

/* ------------------------------------------------------------------ */
/* Notices, objections, award and possession                           */
/* ------------------------------------------------------------------ */

export async function getNotices(caseId: string): Promise<NoticeResponse[]> {
  const { data } = await apiClient.get<NoticeResponse[]>(
    `/acquisition/cases/${caseId}/notices`,
  )
  return data
}

export async function recordNotice(
  caseId: string,
  request: NoticeRequest,
): Promise<NoticeResponse> {
  const { data } = await apiClient.post<NoticeResponse>(
    `/acquisition/cases/${caseId}/notices`,
    request,
  )
  return data
}

export async function getObjections(caseId: string): Promise<ObjectionResponse[]> {
  const { data } = await apiClient.get<ObjectionResponse[]>(
    `/acquisition/cases/${caseId}/objections`,
  )
  return data
}

export async function registerObjection(
  caseId: string,
  request: ObjectionRequest,
): Promise<ObjectionResponse> {
  const { data } = await apiClient.post<ObjectionResponse>(
    `/acquisition/cases/${caseId}/objections`,
    request,
  )
  return data
}

export async function decideObjection(
  caseId: string,
  objectionId: string,
  request: { outcome: 'ACCEPTED' | 'DISMISSED'; remarks: string },
): Promise<ObjectionResponse> {
  const { data } = await apiClient.post<ObjectionResponse>(
    `/acquisition/cases/${caseId}/objections/${objectionId}/decide`,
    { outcome: request.outcome, remarks: request.remarks.trim() },
  )
  return data
}

/** A declared award is returned as 404 until it exists; callers treat that as "not declared yet". */
export async function getAward(caseId: string): Promise<AwardResponse> {
  const { data } = await apiClient.get<AwardResponse>(`/acquisition/cases/${caseId}/award`)
  return data
}

export async function declareAward(
  caseId: string,
  request: DeclareAwardRequest,
): Promise<AwardResponse> {
  const { data } = await apiClient.post<AwardResponse>(
    `/acquisition/cases/${caseId}/award`,
    {
      awardNumber: request.awardNumber.trim(),
      awardDate: request.awardDate,
      remarks: request.remarks?.trim() || null,
    },
  )
  return data
}

export async function getPossessions(caseId: string): Promise<PossessionResponse[]> {
  const { data } = await apiClient.get<PossessionResponse[]>(
    `/acquisition/cases/${caseId}/possessions`,
  )
  return data
}

export async function recordPossession(
  caseId: string,
  request: PossessionRequest,
): Promise<PossessionResponse> {
  const { data } = await apiClient.post<PossessionResponse>(
    `/acquisition/cases/${caseId}/possessions`,
    {
      caseParcelId: request.caseParcelId,
      possessionDate: request.possessionDate,
      possessionType: request.possessionType,
      remarks: request.remarks?.trim() || null,
    },
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Stage transitions                                                   */
/* ------------------------------------------------------------------ */

export async function startSurvey(caseId: string): Promise<CaseResponse> {
  const { data } = await apiClient.post<CaseResponse>(
    `/acquisition/cases/${caseId}/start-survey`,
  )
  return data
}

export async function completeVerification(caseId: string): Promise<CaseResponse> {
  const { data } = await apiClient.post<CaseResponse>(
    `/acquisition/cases/${caseId}/complete-verification`,
  )
  return data
}

export async function issueNotification(caseId: string): Promise<CaseResponse> {
  const { data } = await apiClient.post<CaseResponse>(
    `/acquisition/cases/${caseId}/issue-notification`,
  )
  return data
}

export async function closeObjectionWindow(caseId: string): Promise<CaseResponse> {
  const { data } = await apiClient.post<CaseResponse>(
    `/acquisition/cases/${caseId}/close-objection-window`,
  )
  return data
}

export async function completePossession(caseId: string): Promise<CaseResponse> {
  const { data } = await apiClient.post<CaseResponse>(
    `/acquisition/cases/${caseId}/complete-possession`,
  )
  return data
}

export async function closeCase(caseId: string, reason?: string): Promise<CaseResponse> {
  const trimmed = reason?.trim()
  const { data } = await apiClient.post<CaseResponse>(
    `/acquisition/cases/${caseId}/close`,
    trimmed ? { reason: trimmed } : undefined,
  )
  return data
}

/** Cancelling a case requires a reason; the backend enforces the same rule. */
export async function cancelCase(caseId: string, reason: string): Promise<CaseResponse> {
  const { data } = await apiClient.post<CaseResponse>(
    `/acquisition/cases/${caseId}/cancel`,
    { reason: reason.trim() },
  )
  return data
}
