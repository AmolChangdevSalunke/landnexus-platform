import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { toApiErrorInfo, type ApiErrorInfo } from '../api/errors'

export interface UseApiQueryResult<T> {
  data: T | null
  error: ApiErrorInfo | null
  isLoading: boolean
  reload: () => void
}

/**
 * Small data-fetching hook for read-only endpoints.
 *
 * Pass a stable fetcher and an explicit dependency list. The latest fetcher is
 * kept in a ref so inline arrow functions do not cause a fetch on every render.
 */
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  enabled = true,
): UseApiQueryResult<T> {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiErrorInfo | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [revision, setRevision] = useState(0)

  const reload = useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(toApiErrorInfo(caught))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, revision, ...deps])

  return { data, error, isLoading, reload }
}
