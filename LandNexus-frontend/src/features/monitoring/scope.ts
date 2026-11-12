import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Geographic scope for the monitoring screens. The backend decides what a
 * user may see; these are optional narrowing filters and are kept in the URL so
 * a view can be linked and reloaded.
 */
export interface MonitoringScope {
  stateId: string
  districtId: string
  hasScope: boolean
  setStateId: (stateId: string) => void
  setDistrictId: (districtId: string) => void
  selectDistrict: (districtId: string) => void
  clearScope: () => void
}

export function useMonitoringScope(): MonitoringScope {
  const [params, setParams] = useSearchParams()
  const stateId = params.get('stateId') ?? ''
  const districtId = params.get('districtId') ?? ''

  const setStateId = useCallback(
    (nextStateId: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (nextStateId) {
            next.set('stateId', nextStateId)
          } else {
            next.delete('stateId')
          }
          // A district belongs to one state, so a state change resets it.
          next.delete('districtId')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setDistrictId = useCallback(
    (nextDistrictId: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (nextDistrictId) {
            next.set('districtId', nextDistrictId)
          } else {
            next.delete('districtId')
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const selectDistrict = useCallback(
    (nextDistrictId: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.delete('stateId')
          if (nextDistrictId) {
            next.set('districtId', nextDistrictId)
          } else {
            next.delete('districtId')
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const clearScope = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('stateId')
        next.delete('districtId')
        return next
      },
      { replace: true },
    )
  }, [setParams])

  return {
    stateId,
    districtId,
    hasScope: Boolean(stateId || districtId),
    setStateId,
    setDistrictId,
    selectDistrict,
    clearScope,
  }
}
