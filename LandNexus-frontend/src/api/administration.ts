import { apiClient } from './client'
import type {
  DepartmentRequest,
  DepartmentResponse,
  DistrictRequest,
  DistrictResponse,
  DivisionRequest,
  DivisionResponse,
  MinistryRequest,
  MinistryResponse,
  PageResponse,
  RecordStatus,
  StateRequest,
  StateResponse,
  TalukaRequest,
  TalukaResponse,
  VillageRequest,
  VillageResponse,
} from './types'

/** Every master-data resource exposed by the administration API. */
export const MASTER_RESOURCES = [
  'ministries',
  'departments',
  'states',
  'divisions',
  'districts',
  'talukas',
  'villages',
] as const

export type MasterResource = (typeof MASTER_RESOURCES)[number]

export interface MasterResponseByResource {
  ministries: MinistryResponse
  departments: DepartmentResponse
  states: StateResponse
  divisions: DivisionResponse
  districts: DistrictResponse
  talukas: TalukaResponse
  villages: VillageResponse
}

export interface MasterRequestByResource {
  ministries: MinistryRequest
  departments: DepartmentRequest
  states: StateRequest
  divisions: DivisionRequest
  districts: DistrictRequest
  talukas: TalukaRequest
  villages: VillageRequest
}

export type MasterRecord = MasterResponseByResource[MasterResource]
export type MasterRequest = MasterRequestByResource[MasterResource]

export interface MasterListParams {
  page?: number
  size?: number
  /** Optional parent id. The API maps it to ministryId, stateId, districtId or talukaId. */
  parentId?: string
}

const PARENT_PARAM: Record<MasterResource, string | null> = {
  ministries: null,
  departments: 'ministryId',
  states: null,
  divisions: 'stateId',
  districts: 'stateId',
  talukas: 'districtId',
  villages: 'talukaId',
}

export function isMasterResource(value: string | undefined): value is MasterResource {
  return Boolean(value && (MASTER_RESOURCES as readonly string[]).includes(value))
}

/** One page of a master-data list. Reads require MASTER_DATA_READ on the backend. */
export async function listMaster<K extends MasterResource>(
  resource: K,
  params: MasterListParams = {},
): Promise<PageResponse<MasterResponseByResource[K]>> {
  const query: Record<string, string | number> = {
    page: params.page ?? 0,
    size: params.size ?? 20,
  }
  const parentParam = PARENT_PARAM[resource]
  if (parentParam && params.parentId) {
    query[parentParam] = params.parentId
  }

  const { data } = await apiClient.get<PageResponse<MasterResponseByResource[K]>>(
    `/administration/${resource}`,
    { params: query },
  )
  return data
}

/** Creates a master record. Writes require MASTER_DATA_WRITE on the backend. */
export async function createMaster<K extends MasterResource>(
  resource: K,
  request: MasterRequestByResource[K],
): Promise<MasterResponseByResource[K]> {
  const { data } = await apiClient.post<MasterResponseByResource[K]>(
    `/administration/${resource}`,
    request,
  )
  return data
}

export async function updateMaster<K extends MasterResource>(
  resource: K,
  id: string,
  request: MasterRequestByResource[K],
): Promise<MasterResponseByResource[K]> {
  const { data } = await apiClient.put<MasterResponseByResource[K]>(
    `/administration/${resource}/${id}`,
    request,
  )
  return data
}

/** Master records are never deleted; they are activated or deactivated. */
export async function setMasterStatus<K extends MasterResource>(
  resource: K,
  id: string,
  status: RecordStatus,
): Promise<MasterResponseByResource[K]> {
  const action = status === 'ACTIVE' ? 'activate' : 'deactivate'
  const { data } = await apiClient.post<MasterResponseByResource[K]>(
    `/administration/${resource}/${id}/${action}`,
  )
  return data
}

/**
 * Districts the signed-in user may work with.
 * National roles receive all districts; scoped roles receive their assignments.
 */
export async function getMyDistricts(
  page = 0,
  size = 100,
): Promise<PageResponse<DistrictResponse>> {
  const { data } = await apiClient.get<PageResponse<DistrictResponse>>(
    '/administration/my-districts',
    { params: { page, size } },
  )
  return data
}

/** State master data, used to resolve project state IDs to map names. */
export function getStates(page = 0, size = 100): Promise<PageResponse<StateResponse>> {
  return listMaster('states', { page, size })
}

/** Department master data. The list contains active and inactive records. */
export function getDepartments(page = 0, size = 100): Promise<PageResponse<DepartmentResponse>> {
  return listMaster('departments', { page, size })
}

/** Talukas of one district. */
export function getTalukas(
  districtId: string,
  page = 0,
  size = 100,
): Promise<PageResponse<TalukaResponse>> {
  return listMaster('talukas', { page, size, parentId: districtId })
}

/** Villages of one taluka. */
export function getVillages(
  talukaId: string,
  page = 0,
  size = 100,
): Promise<PageResponse<VillageResponse>> {
  return listMaster('villages', { page, size, parentId: talukaId })
}

/** A parent record shown in a filter or a form select. */
export interface MasterParentOption {
  id: string
  name: string
  status: RecordStatus
  detail?: string
}
