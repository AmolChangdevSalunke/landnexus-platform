import { apiClient } from './client'
import type {
  MyTask,
  PageResponse,
  ProposalAction,
  ProposalAssignment,
  ProposalHistoryEntry,
  ProposalRequest,
  ProposalResponse,
  ProposalStatus,
  ProposalValidationResponse,
  ProposalVersion,
} from './types'

export interface ProposalListParams {
  status?: ProposalStatus
  districtId?: string
  page?: number
  size?: number
}

/** Proposals visible to the caller (own proposals or the caller's geographic scope). */
export async function getProposals({
  status,
  districtId,
  page = 0,
  size = 20,
}: ProposalListParams): Promise<PageResponse<ProposalResponse>> {
  const { data } = await apiClient.get<PageResponse<ProposalResponse>>('/projects/proposals', {
    params: {
      status: status || undefined,
      districtId: districtId || undefined,
      page,
      size,
    },
  })
  return data
}

export async function getProposal(id: string): Promise<ProposalResponse> {
  const { data } = await apiClient.get<ProposalResponse>(`/projects/proposals/${id}`)
  return data
}

export async function createProposal(request: ProposalRequest): Promise<ProposalResponse> {
  const { data } = await apiClient.post<ProposalResponse>('/projects/proposals', request)
  return data
}

export async function updateProposal(
  id: string,
  request: ProposalRequest,
): Promise<ProposalResponse> {
  const { data } = await apiClient.put<ProposalResponse>(`/projects/proposals/${id}`, request)
  return data
}

/** Oldest first, as returned by the backend. */
export async function getProposalHistory(id: string): Promise<ProposalHistoryEntry[]> {
  const { data } = await apiClient.get<ProposalHistoryEntry[]>(
    `/projects/proposals/${id}/history`,
  )
  return data
}

/** Oldest first, as returned by the backend. */
export async function getProposalVersions(id: string): Promise<ProposalVersion[]> {
  const { data } = await apiClient.get<ProposalVersion[]>(
    `/projects/proposals/${id}/versions`,
  )
  return data
}

export async function getProposalValidation(id: string): Promise<ProposalValidationResponse> {
  const { data } = await apiClient.get<ProposalValidationResponse>(`/projects/proposals/${id}/validation`)
  return data
}

/** Routing history of one proposal, oldest first. */
export async function getProposalAssignments(id: string): Promise<ProposalAssignment[]> {
  const { data } = await apiClient.get<ProposalAssignment[]>(`/projects/proposals/${id}/assignments`)
  return data
}

/** Open assignments of the signed-in user, newest first. */
export async function getMyTasks(page = 0, size = 20): Promise<PageResponse<MyTask>> {
  const { data } = await apiClient.get<PageResponse<MyTask>>('/projects/proposals/my-tasks', {
    params: { page, size },
  })
  return data
}

const ACTION_ENDPOINTS: Record<ProposalAction, string> = {
  SUBMIT: 'submit',
  RESUBMIT: 'resubmit',
  START_SCRUTINY: 'start-scrutiny',
  REQUEST_CLARIFICATION: 'clarification',
  RECOMMEND: 'recommend',
  REJECT_SCRUTINY: 'reject',
  APPROVE: 'approve',
  REJECT: 'reject',
}

/**
 * Runs one workflow action. The server decides whether it is allowed in the
 * current state; the UI only sends the action that came from availableActions.
 */
export async function performProposalAction(
  id: string,
  action: ProposalAction,
  reason?: string,
): Promise<ProposalResponse> {
  const trimmed = reason?.trim()
  const { data } = await apiClient.post<ProposalResponse>(
    `/projects/proposals/${id}/${ACTION_ENDPOINTS[action]}`,
    trimmed ? { reason: trimmed } : undefined,
  )
  return data
}
