import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { MasterDataPage } from './MasterDataPage'
import { API_BASE_URL } from '../../../api/client'
import type { DepartmentResponse, MinistryResponse } from '../../../api/types'
import { TEST_USER } from '../../../test/handlers'
import { renderWithProviders } from '../../../test/render'
import { server } from '../../../test/server'

const AUTH = {
  user: {
    ...TEST_USER,
    permissions: ['MASTER_DATA_READ', 'MASTER_DATA_WRITE'],
  },
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

const MINISTRY: MinistryResponse = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  code: 'INFRA',
  name: 'Infrastructure',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
}

const DEPARTMENT: DepartmentResponse = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  code: 'PWD',
  name: 'Public Works',
  status: 'ACTIVE',
  ministryId: MINISTRY.id,
  ministryName: MINISTRY.name,
  level: 'STATE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
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

function renderMaster(resource: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/master/:resource" element={<MasterDataPage />} />
    </Routes>,
    { auth: AUTH, initialEntries: [`/admin/master/${resource}`] },
  )
}

describe('MasterDataPage', () => {
  it('lists master records and deactivates one after confirmation', async () => {
    const user = userEvent.setup()
    let deactivatedId: string | null = null

    server.use(
      http.get(`${API_BASE_URL}/administration/ministries`, () =>
        HttpResponse.json(page([MINISTRY])),
      ),
      http.post(
        `${API_BASE_URL}/administration/ministries/:id/deactivate`,
        ({ params }) => {
          deactivatedId = String(params.id)
          return HttpResponse.json({ ...MINISTRY, status: 'INACTIVE' })
        },
      ),
    )

    renderMaster('ministries')

    await screen.findByRole('heading', { name: 'Ministries' })
    expect(await screen.findByText('Infrastructure')).toBeInTheDocument()
    expect(screen.getByText('INFRA')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/will be deactivated/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(deactivatedId).toBe(MINISTRY.id))
  })

  it('validates the create form and sends the exact ministry request', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown = null

    server.use(
      http.get(`${API_BASE_URL}/administration/ministries`, () =>
        HttpResponse.json(page([])),
      ),
      http.post(`${API_BASE_URL}/administration/ministries`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(
          { ...MINISTRY, code: 'WATER', name: 'Water Resources' },
          { status: 201 },
        )
      }),
    )

    renderMaster('ministries')
    await screen.findByRole('heading', { name: 'Ministries' })

    await user.click(screen.getByRole('button', { name: 'New ministry' }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Create ministry' }))
    expect(within(dialog).getByText('Code is required.')).toBeInTheDocument()
    expect(within(dialog).getByText('Name is required.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/Code/), 'water')
    await user.type(within(dialog).getByLabelText(/Name/), 'Water Resources')
    await user.click(within(dialog).getByRole('button', { name: 'Create ministry' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toEqual({ code: 'water', name: 'Water Resources' })
  })

  it('sends the parent id when filtering departments', async () => {
    const user = userEvent.setup()
    const departmentRequests: Array<string | null> = []

    server.use(
      http.get(`${API_BASE_URL}/administration/ministries`, () =>
        HttpResponse.json(page([MINISTRY], 100)),
      ),
      http.get(`${API_BASE_URL}/administration/departments`, ({ request }) => {
        const url = new URL(request.url)
        departmentRequests.push(url.searchParams.get('ministryId'))
        return HttpResponse.json(page([DEPARTMENT]))
      }),
    )

    renderMaster('departments')

    await screen.findByRole('heading', { name: 'Departments' })
    expect(await screen.findByText('Public Works')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Ministry'), MINISTRY.id)

    await waitFor(() => expect(departmentRequests).toContain(MINISTRY.id))
  })
})
