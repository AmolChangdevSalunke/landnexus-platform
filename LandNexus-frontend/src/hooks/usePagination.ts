import { useCallback, useState } from 'react'

export const PAGE_SIZES = [10, 20, 50] as const

export interface UsePaginationResult {
  page: number
  size: number
  setPage: (page: number) => void
  setSize: (size: number) => void
  reset: () => void
}

export function usePagination(initialSize = 20): UsePaginationResult {
  const [page, setPageState] = useState(0)
  const [size, setSizeState] = useState(initialSize)

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(0, next))
  }, [])

  const setSize = useCallback((next: number) => {
    setSizeState(next)
    setPageState(0)
  }, [])

  const reset = useCallback(() => {
    setPageState(0)
  }, [])

  return { page, size, setPage, setSize, reset }
}
