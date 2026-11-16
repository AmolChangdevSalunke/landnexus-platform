import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    expect(
      screen.queryByRole('button', { name: 'Edit permissions' }),
    ).not.toBeInTheDocument()
  })

  it('lets a role manager update a role permission set after explicit confirmation', async () => {
    const user = userEvent.setup()
    let updatedPermissions: string[] | null = null
    server.use(
      http.get(`${API_BASE_URL}/administration/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${API_BASE_URL}/administration/permissions`, () =>
        HttpResponse.json([
          { id: 'p1', code: 'USER_READ', description: 'Read users' },
          { id: 'p2', code: 'USER_WRITE', description: 'Manage users' },
          { id: 'p3', code: 'MASTER_DATA_READ', description: 'Read master data' },
          { id: 'p4', code: 'AUDIT_READ', description: 'Read audit history' },
          { id: 'p5', code: 'ROLE_MANAGE', description: 'Manage role permissions' },
        ]),
      ),
      http.put(`${API_BASE_URL}/administration/roles/:id/permissions`, async ({ request }) => {
        const body = (await request.json()) as { permissions: string[] }
        updatedPermissions = body.permissions
        return HttpResponse.json({ ...ROLES[1], permissions: body.permissions })
      }),
    )

    renderWithProviders(<RolesPage />, {
      auth: {
        ...AUTH,
        user: { ...TEST_USER, permissions: ['USER_READ', 'ROLE_MANAGE'] },
      },
    })

    await user.click(await screen.findAllByRole('button', { name: 'Edit permissions' }).then((buttons) => buttons[1]))
    const editor = await screen.findByRole('dialog', { name: 'Edit permissions · AUDITOR' })
    await user.click(within(editor).getByLabelText(/Manage users/))
    await user.click(within(editor).getByRole('button', { name: 'Review and save' }))

    const confirmation = await screen.findByRole('dialog', {
      name: 'Confirm role permission change',
    })
    await user.click(within(confirmation).getByRole('button', { name: 'Apply permission changes' }))

    await waitFor(() => {
      expect(updatedPermissions).toEqual(['USER_READ', 'AUDIT_READ', 'USER_WRITE'])
    })
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Edit permissions · AUDITOR' }),
      ).not.toBeInTheDocument()
    })
  })

  it('shows role permission audit history only to users with audit access', async () => {
    let requestedEntityType: string | null = null
    server.use(
      http.get(`${API_BASE_URL}/administration/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${API_BASE_URL}/administration/audit-events`, ({ request }) => {
        requestedEntityType = new URL(request.url).searchParams.get('entityType')
        return HttpResponse.json({
          content: [{
            id: 'audit-1',
            occurredAt: '2026-11-16T10:00:00Z',
            actorUserId: 'actor-1',
            actorUsername: 'admin',
            action: 'UPDATE_PERMISSIONS',
            entityType: 'Role',
            entityId: 'r2',
            details: 'AUDITOR permissions updated',
          }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        })
      }),
    )

    renderWithProviders(<RolesPage />, {
      auth: {
        ...AUTH,
        user: { ...TEST_USER, permissions: ['USER_READ', 'AUDIT_READ'] },
      },
    })

    expect(await screen.findByText('Role and permission change history')).toBeInTheDocument()
    expect(await screen.findByText('AUDITOR permissions updated')).toBeInTheDocument()
    expect(requestedEntityType).toBe('Role')
  })
})
