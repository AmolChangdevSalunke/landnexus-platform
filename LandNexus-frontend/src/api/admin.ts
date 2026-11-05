import { apiClient } from './client'
import type {
  AuditEventResponse,
  LoginHistoryResponse,
  PageResponse,
  RoleResponse,
  ScopeEntryResponse,
  UserCreateRequest,
  UserResponse,
  UserScopesRequest,
} from './types'

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

/** Paged user list. Requires USER_READ on the backend. */
export async function getUsers(page = 0, size = 20): Promise<PageResponse<UserResponse>> {
  const { data } = await apiClient.get<PageResponse<UserResponse>>('/administration/users', {
    params: { page, size },
  })
  return data
}

export async function getUser(id: string): Promise<UserResponse> {
  const { data } = await apiClient.get<UserResponse>(`/administration/users/${id}`)
  return data
}

/** Creates an account. Requires USER_WRITE on the backend. */
export async function createUser(request: UserCreateRequest): Promise<UserResponse> {
  const { data } = await apiClient.post<UserResponse>('/administration/users', request)
  return data
}

/** Replaces the complete role set of an account. */
export async function updateUserRoles(id: string, roles: string[]): Promise<UserResponse> {
  const { data } = await apiClient.put<UserResponse>(`/administration/users/${id}/roles`, {
    roles,
  })
  return data
}

/** Enables or disables an account and revokes its refresh tokens on the backend. */
export async function setUserEnabled(id: string, enabled: boolean): Promise<UserResponse> {
  const action = enabled ? 'enable' : 'disable'
  const { data } = await apiClient.post<UserResponse>(
    `/administration/users/${id}/${action}`,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Roles and geographic scope                                          */
/* ------------------------------------------------------------------ */

/** All roles with their permission codes. Read-only; requires USER_READ. */
export async function getRoles(): Promise<RoleResponse[]> {
  const { data } = await apiClient.get<RoleResponse[]>('/administration/roles')
  return data
}

export async function getUserScopes(id: string): Promise<ScopeEntryResponse[]> {
  const { data } = await apiClient.get<ScopeEntryResponse[]>(
    `/administration/users/${id}/scopes`,
  )
  return data
}

/** Replaces the complete geographic scope list for an account. */
export async function replaceUserScopes(
  id: string,
  request: UserScopesRequest,
): Promise<ScopeEntryResponse[]> {
  const { data } = await apiClient.put<ScopeEntryResponse[]>(
    `/administration/users/${id}/scopes`,
    request,
  )
  return data
}

/* ------------------------------------------------------------------ */
/* Audit trail and login history                                       */
/* ------------------------------------------------------------------ */

export interface AuditEventFilters {
  entityType?: string
  entityId?: string
  actor?: string
  page?: number
  size?: number
}

/** Newest-first audit events. Strictly read-only. Requires AUDIT_READ. */
export async function getAuditEvents(
  filters: AuditEventFilters = {},
): Promise<PageResponse<AuditEventResponse>> {
  const params: Record<string, string | number> = {
    page: filters.page ?? 0,
    size: filters.size ?? 20,
  }
  if (filters.entityType) {
    params.entityType = filters.entityType
  }
  if (filters.entityId) {
    params.entityId = filters.entityId
  }
  if (filters.actor) {
    params.actor = filters.actor
  }

  const { data } = await apiClient.get<PageResponse<AuditEventResponse>>(
    '/administration/audit-events',
    { params },
  )
  return data
}

/** Newest-first login attempts. Strictly read-only. Requires AUDIT_READ. */
export async function getLoginHistory(
  username?: string,
  page = 0,
  size = 20,
): Promise<PageResponse<LoginHistoryResponse>> {
  const params: Record<string, string | number> = { page, size }
  if (username) {
    params.username = username
  }

  const { data } = await apiClient.get<PageResponse<LoginHistoryResponse>>(
    '/administration/login-history',
    { params },
  )
  return data
}
