import type { ApiErrorInfo } from '../../api/errors'
import { getMyDistricts } from '../../api/administration'
import type { DistrictResponse } from '../../api/types'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'

/** Must match GeoScopeService.NATIONAL_ROLES on the backend. */
const NATIONAL_ROLES = new Set(['SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'AUDITOR'])

interface ScopeDistrictPayload {
  districts: DistrictResponse[]
  total: number
}

/**
 * Loads every district the caller may work with. Nationwide roles only need the
 * total, because their map is the whole country. The backend caps pages at 100,
 * so scoped roles are paged through until complete.
 */
async function loadScopeDistricts(nationwide: boolean): Promise<ScopeDistrictPayload> {
  const first = await getMyDistricts(0, nationwide ? 1 : 100)
  if (nationwide) {
    return { districts: [], total: first.totalElements }
  }

  const districts = [...first.content]
  for (let page = 1; page < first.totalPages; page += 1) {
    const next = await getMyDistricts(page, 100)
    districts.push(...next.content)
  }

  return { districts, total: first.totalElements }
}

export interface ScopeDistrictsResult {
  districts: DistrictResponse[]
  total: number | null
  enabled: boolean
  isLoading: boolean
  error: ApiErrorInfo | null
  isNationwide: boolean
}

export function useScopeDistricts(): ScopeDistrictsResult {
  const { user, can } = useAuth()
  const enabled = can(PERMISSION.MASTER_DATA_READ)
  const isNationwide = Boolean(user?.roles.some((role) => NATIONAL_ROLES.has(role)))
  const { data, isLoading, error } = useApiQuery(
    () => loadScopeDistricts(isNationwide),
    [enabled, isNationwide, user?.id],
    enabled,
  )

  return {
    districts: data?.districts ?? [],
    total: data?.total ?? null,
    enabled,
    isLoading,
    error,
    isNationwide,
  }
}
