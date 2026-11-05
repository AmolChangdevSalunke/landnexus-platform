import { apiClient } from './client'
import type { PageResponse, ProjectResponse } from './types'

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
