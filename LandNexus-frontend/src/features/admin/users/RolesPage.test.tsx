import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RolesPage } from './RolesPage'
import { API_BASE_URL } from '../../../api/client'
import type { RoleResponse } from '../../../api/types'
import { TEST_USER } from '../../../test/handlers'
import { renderWithProviders } from '../../../test/render'
import { server } from '../../../test/server'

const ROLES: RoleResponse[] = [
  {
    id: 'r1',
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Full system control',
    permissions: ['USER_READ', 'USER_WRITE', 'MASTER_DATA_READ'],
  },
  {
    id: 'r2',
    code: 'AUDITOR',
    name: 'Auditor',
    description: 'Read-only access for audit',
    permissions: ['USER_READ', 'AUDIT_READ'],
  },
]

const AUTH = {
  user: { ...TEST_USER, permissions: ['USER_READ'] },
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

describe('RolesPage', () => {
  it('shows the role catalogue and the permission matrix as read-only', async () => {
    server.use(
      http.get(`${API_BASE_URL}/administration/roles`, () => HttpResponse.json(ROLES)),
    )

    renderWithProviders(<RolesPage />, { auth: AUTH })

    await screen.findByRole('heading', { name: 'Roles and permissions' })
    expect(await screen.findByText('Role catalogue')).toBeInTheDocument()
    expect(screen.getByText('Permission matrix')).toBeInTheDocument()
    expect(screen.getAllByText('Super Administrator').length).toBeGreaterThan(0)
    expect(screen.getByText('Read-only reference data')).toBeInTheDocument()

    // 4 distinct permissions across the two roles.
    expect(screen.getByText('Distinct permissions').nextElementSibling).toHaveTextContent('4')

    const granted = screen.getByLabelText('AUDITOR has AUDIT_READ')
    expect(granted).toHaveTextContent('✓')
    expect(screen.getByLabelText('AUDITOR does not have USER_WRITE')).toHaveTextContent('—')

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })
})
