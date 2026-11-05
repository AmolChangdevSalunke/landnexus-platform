import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { RequirePermission } from './RequirePermission'
import { TEST_USER } from '../../test/handlers'
import { createTestStore, renderWithProviders } from '../../test/render'

describe('ProtectedRoute', () => {
  function renderRoutes() {
    return (
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<p>Private workspace</p>} />
        </Route>
        <Route path="/login" element={<p>Sign in page</p>} />
      </Routes>
    )
  }

  it('shows a loader while the session is being restored', () => {
    renderWithProviders(renderRoutes(), {
      auth: { status: 'loading' },
      initialEntries: ['/private'],
    })

    expect(screen.getByRole('status', { name: 'Restoring your session' })).toBeInTheDocument()
    expect(screen.queryByText('Private workspace')).not.toBeInTheDocument()
  })

  it('redirects an anonymous visitor to sign in', () => {
    renderWithProviders(renderRoutes(), {
      auth: { status: 'anonymous' },
      initialEntries: ['/private'],
    })

    expect(screen.getByText('Sign in page')).toBeInTheDocument()
    expect(screen.queryByText('Private workspace')).not.toBeInTheDocument()
  })

  it('renders the protected page for an authenticated user', () => {
    renderWithProviders(renderRoutes(), {
      auth: { status: 'authenticated', user: TEST_USER },
      initialEntries: ['/private'],
    })

    expect(screen.getByText('Private workspace')).toBeInTheDocument()
  })
})

describe('RequirePermission', () => {
  function renderGuarded(any: string[]) {
    return (
      <Routes>
        <Route
          path="/guarded"
          element={
            <RequirePermission any={any}>
              <p>Guarded content</p>
            </RequirePermission>
          }
        />
      </Routes>
    )
  }

  it('shows the 403 screen when the permission is missing', () => {
    renderWithProviders(renderGuarded(['AUDIT_READ']), {
      auth: { status: 'authenticated', user: TEST_USER },
      initialEntries: ['/guarded'],
    })

    expect(screen.getByRole('heading', { name: 'No access' })).toBeInTheDocument()
    expect(screen.queryByText('Guarded content')).not.toBeInTheDocument()
  })

  it('renders children when any requested permission is present', () => {
    renderWithProviders(renderGuarded(['AUDIT_READ', 'PROPOSAL_CREATE']), {
      auth: { status: 'authenticated', user: TEST_USER },
      initialEntries: ['/guarded'],
    })

    expect(screen.getByText('Guarded content')).toBeInTheDocument()
  })
})

describe('store shape used by guards', () => {
  it('keeps the user when authenticated', () => {
    const store = createTestStore({ status: 'authenticated', user: TEST_USER })
    expect(store.getState().auth.user?.id).toBe(TEST_USER.id)
  })
})
