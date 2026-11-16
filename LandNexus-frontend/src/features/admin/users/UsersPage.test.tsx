import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { UsersPage } from './UsersPage'
import { API_BASE_URL } from '../../../api/client'
import type { RoleResponse, StateResponse, UserResponse } from '../../../api/types'
import { TEST_USER } from '../../../test/handlers'
import { renderWithProviders } from '../../../test/render'
import { server } from '../../../test/server'

const AUTH = {
  user: {
    ...TEST_USER,
    roles: ['CENTRAL_ADMIN'],
    permissions: ['USER_READ', 'USER_WRITE', 'MASTER_DATA_READ'],
  },
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

const ROLES: RoleResponse[] = [
  {
    id: 'r1',
    code: 'CENTRAL_ADMIN',
    name: 'Central Administrator',
    description: 'Central administration',
    permissions: ['USER_READ', 'USER_WRITE', 'MASTER_DATA_READ'],
  },
  {
    id: 'r2',
    code: 'CONSULTANT',
    name: 'Consultant',
    description: 'Prepares proposals',
    permissions: ['PROPOSAL_CREATE'],
  },
  {
    id: 'r3',
    code: 'AUDITOR',
    name: 'Auditor',
    description: 'Read-only audit access',
    permissions: ['AUDIT_READ'],
  },
  {
    id: 'r4',
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Full system control',
    permissions: ['USER_READ', 'USER_WRITE'],
  },
]

const ALICE: UserResponse = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  username: 'alice.admin',
  email: 'alice.admin@example.gov.in',
  fullName: 'Alice Admin',
  enabled: true,
  roles: ['CONSULTANT'],
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

const SELF: UserResponse = {
  id: TEST_USER.id,
  username: TEST_USER.username,
  email: TEST_USER.email,
  fullName: TEST_USER.fullName,
  enabled: true,
  roles: ['CENTRAL_ADMIN'],
  lastLoginAt: '2026-02-01T10:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
}

const SUPER: UserResponse = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  username: 'super.admin',
  email: 'super.admin@example.gov.in',
  fullName: 'Super Admin',
  enabled: true,
  roles: ['SUPER_ADMIN'],
  lastLoginAt: '2026-02-01T09:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
}

const STATE: StateResponse = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  code: 'MH',
  name: 'Maharashtra',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function page<T>(content: T[], size = 20) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
  }
}

function useDefaultHandlers() {
  server.use(
    http.get(`${API_BASE_URL}/administration/users`, () =>
      HttpResponse.json(page([ALICE, SELF, SUPER])),
    ),
    http.get(`${API_BASE_URL}/administration/roles`, () => HttpResponse.json(ROLES)),
  )
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr')
  if (!row) {
    throw new Error(`Row not found for ${name}`)
  }
  return row
}

function renderPage() {
  return renderWithProviders(<UsersPage />, { auth: AUTH })
}

describe('UsersPage', () => {
  it('disables an account after confirmation', async () => {
    const user = userEvent.setup()
    let disabledId: string | null = null

    useDefaultHandlers()
    server.use(
      http.post(`${API_BASE_URL}/administration/users/:id/disable`, ({ params }) => {
        disabledId = String(params.id)
        return HttpResponse.json({ ...ALICE, enabled: false })
      }),
    )

    renderPage()
    await screen.findByRole('heading', { name: 'Users' })
    const row = await screen.findByText('Alice Admin')
    const aliceRow = row.closest('tr')
    if (!aliceRow) {
      throw new Error('Alice row missing')
    }

    await user.click(within(aliceRow).getByRole('button', { name: 'Disable' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/refresh tokens are revoked/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Disable account' }))

    await waitFor(() => expect(disabledId).toBe(ALICE.id))
  })

  it('protects the signed-in account and SUPER_ADMIN accounts', async () => {
    useDefaultHandlers()
    renderPage()

    await screen.findByText('Alice Admin')

    const selfRow = rowFor(TEST_USER.fullName)
    expect(within(selfRow).getByRole('button', { name: 'Disable' })).toBeDisabled()
    expect(within(selfRow).getByRole('button', { name: 'Disable' })).toHaveAttribute(
      'title',
      'You cannot disable your own account.',
    )

    const superRow = rowFor('Super Admin')
    expect(within(superRow).getByRole('button', { name: 'Roles' })).toBeDisabled()
    expect(within(superRow).getByRole('button', { name: 'Disable' })).toBeDisabled()
    expect(within(superRow).getByRole('button', { name: 'Roles' })).toHaveAttribute(
      'title',
      'Only a super administrator can change a SUPER_ADMIN account.',
    )

    const aliceRow = rowFor('Alice Admin')
    expect(within(aliceRow).getByRole('button', { name: 'Roles' })).toBeEnabled()
  })

  it('validates and creates a user with the exact request body', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown = null

    useDefaultHandlers()
    server.use(
      http.post(`${API_BASE_URL}/administration/users`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(
          {
            ...ALICE,
            id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            username: 'new.user',
            fullName: 'New User',
            email: 'new.user@example.gov.in',
          },
          { status: 201 },
        )
      }),
    )

    renderPage()
    await screen.findByText('Alice Admin')

    await user.click(screen.getByRole('button', { name: 'New user' }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(within(dialog).getByText('Full name is required.')).toBeInTheDocument()
    expect(within(dialog).getByText('Password is required.')).toBeInTheDocument()
    expect(within(dialog).getByText('Select at least one role.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/Full name/), 'New User')
    await user.type(within(dialog).getByLabelText(/Username/), 'new.user')
    await user.type(
      within(dialog).getByLabelText(/Email/),
      'new.user@example.gov.in',
    )
    await user.type(within(dialog).getByLabelText(/Password/), 'SecretPass12')
    await user.click(within(dialog).getByRole('checkbox', { name: /CONSULTANT/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toEqual({
      username: 'new.user',
      fullName: 'New User',
      email: 'new.user@example.gov.in',
      password: 'SecretPass12',
      roles: ['CONSULTANT'],
    })
  })

  it('replaces the role set of an account', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown = null

    useDefaultHandlers()
    server.use(
      http.put(
        `${API_BASE_URL}/administration/users/:id/roles`,
        async ({ request }) => {
          receivedBody = await request.json()
          return HttpResponse.json({ ...ALICE, roles: ['AUDITOR'] })
        },
      ),
    )

    renderPage()
    await screen.findByText('Alice Admin')

    await user.click(within(rowFor('Alice Admin')).getByRole('button', { name: 'Roles' }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('checkbox', { name: /CONSULTANT/ }))
    await user.click(within(dialog).getByRole('checkbox', { name: /AUDITOR/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Save roles' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toEqual({ roles: ['AUDITOR'] })
  })

  it('updates profile details through the user API', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown = null

    useDefaultHandlers()
    server.use(
      http.put(`${API_BASE_URL}/administration/users/:id`, async ({ params, request }) => {
        expect(String(params.id)).toBe(ALICE.id)
        receivedBody = await request.json()
        return HttpResponse.json({
          ...ALICE,
          fullName: 'Alice Updated',
          email: 'alice.updated@example.gov.in',
        })
      }),
    )

    renderPage()
    await screen.findByText('Alice Admin')
    await user.click(within(rowFor('Alice Admin')).getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByLabelText(/Full name/)
    const email = within(dialog).getByLabelText(/Email/)
    await user.clear(name)
    await user.type(name, 'Alice Updated')
    await user.clear(email)
    await user.type(email, 'alice.updated@example.gov.in')
    await user.click(within(dialog).getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(receivedBody).toEqual({
      fullName: 'Alice Updated',
      email: 'alice.updated@example.gov.in',
    }))
  })

  it('adds a state to the geographic scope and saves the full list', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown = null

    useDefaultHandlers()
    server.use(
      http.get(`${API_BASE_URL}/administration/users/:id/scopes`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/administration/states`, () =>
        HttpResponse.json(page([STATE], 100)),
      ),
      http.put(
        `${API_BASE_URL}/administration/users/:id/scopes`,
        async ({ request }) => {
          receivedBody = await request.json()
          return HttpResponse.json([
            {
              id: 'scope-1',
              type: 'STATE',
              referenceId: STATE.id,
              referenceName: STATE.name,
            },
          ])
        },
      ),
    )

    renderPage()
    await screen.findByText('Alice Admin')

    await user.click(within(rowFor('Alice Admin')).getByRole('button', { name: 'Scope' }))
    const dialog = await screen.findByRole('dialog')

    await screen.findByText('Current assignments')
    await within(dialog).findByRole('option', { name: STATE.name })
    await user.selectOptions(within(dialog).getByLabelText('State'), STATE.id)
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(within(dialog).getByText(STATE.name)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Save scope' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toEqual({ scopes: [{ stateId: STATE.id }] })
  })
})
