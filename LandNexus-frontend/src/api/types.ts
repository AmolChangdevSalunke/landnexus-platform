/**
 * API payloads for the LandNexus backend.
 * Keep this file in sync with the backend contract (section 5 of the frontend brief).
 * IDs are UUID strings, dates are ISO yyyy-MM-dd, timestamps are ISO-8601 UTC instants.
 */

export interface ApiFieldError {
  field: string
  message: string
}

export interface ApiError {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
  fieldErrors: ApiFieldError[]
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type RecordStatus = 'ACTIVE' | 'INACTIVE'

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresInSeconds: number
}

export interface CurrentUser {
  id: string
  username: string
  fullName: string
  email: string
  roles: string[]
  permissions: string[]
}

/* ------------------------------------------------------------------ */
/* Master data                                                         */
/* ------------------------------------------------------------------ */

export interface MasterBase {
  id: string
  code: string
  name: string
  status: RecordStatus
  createdAt: string
  updatedAt: string
}

export interface MinistryResponse extends MasterBase {}
export interface StateResponse extends MasterBase {}

export type DepartmentLevel = 'CENTRAL' | 'STATE' | 'DIVISION' | 'DISTRICT'

export interface DepartmentResponse extends MasterBase {
  ministryId: string
  ministryName: string
  level: DepartmentLevel
}

export interface DivisionResponse extends MasterBase {
  stateId: string
  stateName: string
}

export interface DistrictResponse extends MasterBase {
  stateId: string
  stateName: string
  divisionId: string | null
  divisionName: string | null
}

export interface TalukaResponse extends MasterBase {
  districtId: string
  districtName: string
}

export interface VillageResponse extends MasterBase {
  talukaId: string
  talukaName: string
}

export interface MinistryRequest {
  code: string
  name: string
}

export interface StateRequest {
  code: string
  name: string
}

export interface DepartmentRequest {
  code: string
  name: string
  ministryId: string
  level: DepartmentLevel
}

export interface DivisionRequest {
  code: string
  name: string
  stateId: string
}

export interface DistrictRequest {
  code: string
  name: string
  stateId: string
  divisionId?: string | null
}

export interface TalukaRequest {
  code: string
  name: string
  districtId: string
}

export interface VillageRequest {
  code: string
  name: string
  talukaId: string
}

/* ------------------------------------------------------------------ */
/* Users, roles and scope                                              */
/* ------------------------------------------------------------------ */

export interface UserCreateRequest {
  username: string
  email: string
  fullName: string
  password: string
  roles: string[]
}

export interface UserResponse {
  id: string
  username: string
  email: string
  fullName: string
  enabled: boolean
  roles: string[]
  lastLoginAt: string | null
  createdAt: string
}

export interface RoleResponse {
  id: string
  code: string
  name: string
  description: string
  permissions: string[]
}

export type ScopeType = 'STATE' | 'DIVISION' | 'DISTRICT'

export interface ScopeEntryResponse {
  id: string
  type: ScopeType
  referenceId: string
  referenceName: string
}

export interface ScopeEntryRequest {
  stateId?: string
  divisionId?: string
  districtId?: string
}

export interface UserScopesRequest {
  scopes: ScopeEntryRequest[]
}

export interface UpdateUserRolesRequest {
  roles: string[]
}

/* ------------------------------------------------------------------ */
/* Audit trail and login history                                       */
/* ------------------------------------------------------------------ */

export interface AuditEventResponse {
  id: string
  occurredAt: string
  actorUserId: string | null
  actorUsername: string
  action: string
  entityType: string
  entityId: string | null
  details: string | null
}

export interface LoginHistoryResponse {
  id: string
  occurredAt: string
  userId: string | null
  usernameAttempted: string
  success: boolean
  failureReason: string | null
  ipAddress: string | null
  userAgent: string | null
}

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

export type ProjectType =
  | 'NATIONAL_HIGHWAY'
  | 'STATE_HIGHWAY'
  | 'DISTRICT_ROAD'
  | 'RURAL_ROAD'
  | 'EXPRESSWAY'
  | 'RAILWAY'
  | 'DAM'
  | 'IRRIGATION'
  | 'SCHOOL'
  | 'HOSPITAL'
  | 'GOVERNMENT_BUILDING'
  | 'OTHER_INFRASTRUCTURE'

export const LINEAR_PROJECT_TYPES: readonly ProjectType[] = [
  'NATIONAL_HIGHWAY',
  'STATE_HIGHWAY',
  'DISTRICT_ROAD',
  'RURAL_ROAD',
  'EXPRESSWAY',
  'RAILWAY',
]

export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'CLARIFICATION_REQUESTED'
  | 'RECOMMENDED'
  | 'APPROVED'
  | 'REJECTED'

export type ProposalAction =
  | 'SUBMIT'
  | 'RESUBMIT'
  | 'START_SCRUTINY'
  | 'REQUEST_CLARIFICATION'
  | 'RECOMMEND'
  | 'REJECT_SCRUTINY'
  | 'APPROVE'
  | 'REJECT'

export interface ProposalRequest {
  title: string
  projectType: ProjectType
  districtId: string
  talukaId?: string | null
  departmentId: string
  lengthKm?: number | null
  estimatedLandAreaHa: number
  villageIds: string[]
  alignmentDescription?: string | null
  description: string
  plannedStartDate: string
  plannedEndDate: string
}

export interface ProposalResponse {
  id: string
  proposalNumber: string | null
  title: string
  projectType: ProjectType
  status: ProposalStatus
  versionNo: number
  stateId: string
  districtId: string
  talukaId: string | null
  departmentId: string
  lengthKm: number | null
  estimatedLandAreaHa: number
  villageIds: string[]
  alignmentDescription: string | null
  description: string
  plannedStartDate: string
  plannedEndDate: string
  ownerUserId: string
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  projectCode: string | null
  availableActions: ProposalAction[]
}

export interface ProposalHistoryEntry {
  id: string
  fromStatus: ProposalStatus | null
  toStatus: ProposalStatus
  action: string
  actorUsername: string
  reason: string | null
  occurredAt: string
}

export interface ProposalVersion {
  versionNo: number
  createdByUsername: string
  createdAt: string
  snapshot: string
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export type ProjectStatus = 'ACTIVE' | 'CLOSED'

export interface ProjectResponse {
  id: string
  code: string
  proposalId: string
  title: string
  projectType: ProjectType
  status: ProjectStatus
  stateId: string
  districtId: string
  talukaId: string | null
  departmentId: string
  lengthKm: number | null
  estimatedLandAreaHa: number
  villageIds: string[]
  ownerUserId: string
  approvedByUserId: string
  approvedAt: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  read: boolean
  createdAt: string
}

export interface UnreadCountResponse {
  unread: number
}
