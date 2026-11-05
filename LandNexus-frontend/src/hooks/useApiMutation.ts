import { useCallback, useState } from 'react'
import { toApiErrorInfo, type ApiErrorInfo } from '../api/errors'

export interface UseApiMutationResult<T> {
  mutate: (action: () => Promise<T>) => Promise<T>
  isLoading: boolean
  error: ApiErrorInfo | null
  reset: () => void
}

/**
 * Wraps a single write request with loading and error state.
 * The returned promise rejects on failure so the caller can show a toast.
 */
export function useApiMutation<T>(): UseApiMutationResult<T> {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiErrorInfo | null>(null)

  const reset = useCallback(() => {
    setError(null)
  }, [])

  const mutate = useCallback(async (action: () => Promise<T>): Promise<T> => {
    setIsLoading(true)
    setError(null)
    try {
      return await action()
    } catch (caught: unknown) {
      setError(toApiErrorInfo(caught))
      throw caught
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { mutate, isLoading, error, reset }
}
