import { getMyDistricts } from '../../api/administration'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from './useAuth'

export interface DistrictCountResult {
  total: number | null
  isLoading: boolean
  enabled: boolean
}

/** Number of districts in the signed-in user's scope (from my-districts). */
export function useDistrictCount(): DistrictCountResult {
  const { can } = useAuth()
  const enabled = can(PERMISSION.MASTER_DATA_READ)
  const { data, isLoading } = useApiQuery(
    () => getMyDistricts(0, 1),
    [enabled],
    enabled,
  )

  return {
    total: data?.totalElements ?? null,
    isLoading,
    enabled,
  }
}
