import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { useAuth } from './useAuth'
import { TEST_USER } from '../../test/handlers'
import { createTestStore } from '../../test/render'

function wrapperFor(store: ReturnType<typeof createTestStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
}

describe('useAuth', () => {
  it('reports no session when there is no user', () => {
    const store = createTestStore()
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.can('PROPOSAL_CREATE')).toBe(false)
  })

  it('reads permissions and roles from /auth/me data only', () => {
    const store = createTestStore({
      status: 'authenticated',
      user: TEST_USER,
    })
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.can('PROPOSAL_CREATE')).toBe(true)
    expect(result.current.can('AUDIT_READ')).toBe(false)
    expect(result.current.canAny('AUDIT_READ', 'PROPOSAL_READ_OWN')).toBe(true)
    expect(result.current.canAny('AUDIT_READ', 'USER_READ')).toBe(false)
    expect(result.current.hasRole('CONSULTANT')).toBe(true)
    expect(result.current.hasRole('SUPER_ADMIN')).toBe(false)
  })
})
