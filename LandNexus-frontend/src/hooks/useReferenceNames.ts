import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  getDepartments,
  getMyDistricts,
  getStates,
  getTalukas,
  getVillages,
} from '../api/administration'
import { toApiErrorInfo, type ApiErrorInfo } from '../api/errors'
import { readAllPages } from '../api/pagination'
import type {
  DepartmentResponse,
  DistrictResponse,
  StateResponse,
  TalukaResponse,
  VillageResponse,
} from '../api/types'
import { useAuth } from '../features/auth/useAuth'
import { PERMISSION } from '../utils/permissions'

/* ------------------------------------------------------------------ */
/* In-memory reference cache (one per browser tab/session)             */
/* ------------------------------------------------------------------ */

const districtList: DistrictResponse[] = []
const departmentList: DepartmentResponse[] = []
const stateList: StateResponse[] = []

const districtById = new Map<string, DistrictResponse>()
const departmentById = new Map<string, DepartmentResponse>()
const stateById = new Map<string, StateResponse>()
const talukaById = new Map<string, TalukaResponse>()
const villageById = new Map<string, VillageResponse>()

const talukasByDistrict = new Map<string, TalukaResponse[]>()
const villagesByDistrict = new Map<
  string,
  { all: VillageResponse[]; byTaluka: Map<string, VillageResponse[]> }
>()

let baseLoaded = false
let basePromise: Promise<void> | null = null
let revision = 0

const listeners = new Set<() => void>()
const villagePromises = new Map<string, Promise<void>>()
const loadingVillageDistricts = new Set<string>()
const loadedVillageDistricts = new Set<string>()

function notify(): void {
  revision += 1
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): number {
  return revision
}

function getServerSnapshot(): number {
  return 0
}

function isBaseLoaded(): boolean {
  return baseLoaded
}

function resetBaseReferences(): void {
  baseLoaded = false
  basePromise = null
  districtList.length = 0
  departmentList.length = 0
  stateList.length = 0
  districtById.clear()
  departmentById.clear()
  stateById.clear()
  notify()
}

/** Clears the tab cache. Intended for tests that need different reference data. */
export function resetReferenceCacheForTests(): void {
  resetBaseReferences()
  talukaById.clear()
  villageById.clear()
  talukasByDistrict.clear()
  villagesByDistrict.clear()
  loadedVillageDistricts.clear()
  loadingVillageDistricts.clear()
  villagePromises.clear()
}

/** Loads districts, departments and states once for the whole tab. */
export async function loadBaseReferences(): Promise<void> {
  if (baseLoaded) {
    return
  }

  if (!basePromise) {
    basePromise = Promise.all([
      readAllPages((page) => getMyDistricts(page, 100)),
      readAllPages((page) => getDepartments(page, 100)),
      readAllPages((page) => getStates(page, 100)),
    ])
      .then(([districts, departments, states]) => {
        districtList.splice(0, districtList.length, ...districts)
        departmentList.splice(0, departmentList.length, ...departments)
        stateList.splice(0, stateList.length, ...states)

        districtById.clear()
        districts.forEach((district) => districtById.set(district.id, district))

        departmentById.clear()
        departments.forEach((department) => departmentById.set(department.id, department))

        stateById.clear()
        states.forEach((state) => stateById.set(state.id, state))

        baseLoaded = true
        notify()
      })
      .catch((error: unknown) => {
        basePromise = null
        throw error
      })
  }

  return basePromise
}

/**
 * Loads the talukas and villages of one district lazily. Concurrent callers
 * share the same request. Villages are stored by taluka so the form can group
 * them exactly as the backend lists them.
 */
export function loadDistrictVillages(districtId: string): Promise<void> {
  if (loadedVillageDistricts.has(districtId)) {
    return Promise.resolve()
  }

  const existing = villagePromises.get(districtId)
  if (existing) {
    return existing
  }

  loadingVillageDistricts.add(districtId)
  notify()

  const promise = (async () => {
    const talukas = await readAllPages((page) => getTalukas(districtId, page, 100))
    talukasByDistrict.set(districtId, talukas)
    talukas.forEach((taluka) => talukaById.set(taluka.id, taluka))

    const groups = await Promise.all(
      talukas.map(async (taluka) => ({
        taluka,
        villages: await readAllPages((page) => getVillages(taluka.id, page, 100)),
      })),
    )

    const byTaluka = new Map<string, VillageResponse[]>()
    const all: VillageResponse[] = []

    for (const group of groups) {
      byTaluka.set(group.taluka.id, group.villages)
      for (const village of group.villages) {
        villageById.set(village.id, village)
        all.push(village)
      }
    }

    villagesByDistrict.set(districtId, { all, byTaluka })
    loadedVillageDistricts.add(districtId)
  })().finally(() => {
    loadingVillageDistricts.delete(districtId)
    villagePromises.delete(districtId)
    notify()
  })

  villagePromises.set(districtId, promise)
  return promise
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export interface ReferenceNamesResult {
  enabled: boolean
  isLoading: boolean
  error: ApiErrorInfo | null
  districts: DistrictResponse[]
  departments: DepartmentResponse[]
  states: StateResponse[]
  talukasForDistrict: (districtId: string) => TalukaResponse[]
  villagesForDistrict: (districtId: string) => VillageResponse[]
  villagesByTaluka: (districtId: string) => Map<string, VillageResponse[]>
  ensureDistrictVillages: (districtId: string) => Promise<void>
  isDistrictVillagesLoading: (districtId: string) => boolean
  reload: () => void
  districtName: (id: string | null | undefined) => string | null
  departmentName: (id: string | null | undefined) => string | null
  stateName: (id: string | null | undefined) => string | null
  talukaName: (id: string | null | undefined) => string | null
  villageName: (id: string | null | undefined) => string | null
}

/**
 * Shares district, department, state, taluka and village names between screens.
 * Name look-ups never block a page: an unknown name falls back to a short id in
 * the caller. The backend still decides what the user may read.
 */
export function useReferenceNames(): ReferenceNamesResult {
  const { can } = useAuth()
  const enabled = can(PERMISSION.MASTER_DATA_READ)
  const [error, setError] = useState<ApiErrorInfo | null>(null)
  const [attempt, setAttempt] = useState(0)

  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let active = true
    setError(null)

    loadBaseReferences().catch((caught: unknown) => {
      if (active) {
        setError(toApiErrorInfo(caught))
      }
    })

    return () => {
      active = false
    }
  }, [enabled, attempt])

  const reload = useCallback(() => {
    resetBaseReferences()
    setAttempt((current) => current + 1)
  }, [])

  const ensureDistrictVillages = useCallback(
    (districtId: string) => loadDistrictVillages(districtId),
    [],
  )

  const talukasForDistrict = useCallback(
    (districtId: string) => talukasByDistrict.get(districtId) ?? [],
    [],
  )

  const villagesForDistrict = useCallback(
    (districtId: string) => villagesByDistrict.get(districtId)?.all ?? [],
    [],
  )

  const villagesByTaluka = useCallback(
    (districtId: string) => villagesByDistrict.get(districtId)?.byTaluka ?? new Map(),
    [],
  )

  const isDistrictVillagesLoading = useCallback(
    (districtId: string) => loadingVillageDistricts.has(districtId),
    [],
  )

  return {
    enabled,
    isLoading: enabled && !isBaseLoaded(),
    error: enabled ? error : null,
    districts: districtList,
    departments: departmentList,
    states: stateList,
    talukasForDistrict,
    villagesForDistrict,
    villagesByTaluka,
    ensureDistrictVillages,
    isDistrictVillagesLoading,
    reload,
    districtName: (id) => (id ? (districtById.get(id)?.name ?? null) : null),
    departmentName: (id) => (id ? (departmentById.get(id)?.name ?? null) : null),
    stateName: (id) => (id ? (stateById.get(id)?.name ?? null) : null),
    talukaName: (id) => (id ? (talukaById.get(id)?.name ?? null) : null),
    villageName: (id) => (id ? (villageById.get(id)?.name ?? null) : null),
  }
}
