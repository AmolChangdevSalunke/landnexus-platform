import { apiClient } from './client'
import type {
  PageResponse,
  ProjectResponse,
  ProjectUpdateRequest,
  RoutingRuleRequest,
  RoutingRuleResponse,
} from './types'

export interface ProjectListParams {
  districtId?: string
  page?: number
  size?: number
}

/** Projects visible to the signed-in user. */
export async function getProjects({
  districtId,
  page = 0,
  size = 20,
}: ProjectListParams = {}): Promise<PageResponse<ProjectResponse>> {
  const { data } = await apiClient.get<PageResponse<ProjectResponse>>('/projects', {
    params: {
      districtId: districtId || undefined,
      page,
      size,
    },
  })
  return data
}

export async function getProject(id: string): Promise<ProjectResponse> {
  const { data } = await apiClient.get<ProjectResponse>(`/projects/${id}`)
  return data
}

/** Corrects project details. Requires PROJECT_MANAGE and geographic access on the backend. */
export async function updateProject(
  id: string,
  request: ProjectUpdateRequest,
): Promise<ProjectResponse> {
  const { data } = await apiClient.put<ProjectResponse>(`/projects/${id}`, request)
  return data
}

/** Closes an active project. Requires PROJECT_MANAGE on the backend. */
export async function closeProject(id: string): Promise<ProjectResponse> {
  const { data } = await apiClient.post<ProjectResponse>(`/projects/${id}/close`)
  return data
}

/** Reopens a closed project. Requires PROJECT_MANAGE on the backend. */
export async function reopenProject(id: string): Promise<ProjectResponse> {
  const { data } = await apiClient.post<ProjectResponse>(`/projects/${id}/reopen`)
  return data
}

export async function getRoutingRules(): Promise<RoutingRuleResponse[]> {
  const { data } = await apiClient.get<RoutingRuleResponse[]>('/projects/routing-rules')
  return data
}

export async function createRoutingRule(
  request: RoutingRuleRequest,
): Promise<RoutingRuleResponse> {
  const { data } = await apiClient.post<RoutingRuleResponse>(
    '/projects/routing-rules',
    request,
  )
  return data
}

export async function updateRoutingRule(
  id: string,
  request: RoutingRuleRequest,
): Promise<RoutingRuleResponse> {
  const { data } = await apiClient.put<RoutingRuleResponse>(
    `/projects/routing-rules/${id}`,
    request,
  )
  return data
}

export async function setRoutingRuleActive(
  id: string,
  active: boolean,
): Promise<RoutingRuleResponse> {
  const action = active ? 'activate' : 'deactivate'
  const { data } = await apiClient.post<RoutingRuleResponse>(
    `/projects/routing-rules/${id}/${action}`,
  )
  return data
}
