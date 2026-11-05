import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ProjectListPage } from './ProjectListPage'
import { API_BASE_URL } from '../../api/client'
import type { DistrictResponse, ProjectResponse } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { TEST_USER } from '../../test/handlers'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'

const USER = {
  ...TEST_USER,
  permissions: [...TEST_USER.permissions, 'MASTER_DATA_READ'],
}

const AUTH = {
  user: USER,
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

const DISTRICT: DistrictResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  code: 'PUNE',
  name: 'Pune',
  status: 'ACTIVE',
  stateId: '11111111-1111-1111-1111-111111111111',
  stateName: 'Maharashtra',
  divisionId: null,
  divisionName: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const PROJECT: ProjectResponse = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  code: 'PRJ-2026-000001',
  proposalId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  title: 'District hospital upgrade',
  projectType: 'HOSPITAL',
  status: 'ACTIVE',
  stateId: '11111111-1111-1111-1111-111111111111',
  districtId: DISTRICT.id,
  talukaId: null,
  departmentId: '33333333-3333-3333-3333-333333333333',
  lengthKm: null,
  estimatedLandAreaHa: 2.5,
  villageIds: ['44444444-4444-4444-4444-444444444444'],
  ownerUserId: '55555555-5555-5555-5555-555555555555',
  approvedByUserId: '66666666-6666-6666-6666-666666666666',
  approvedAt: '2026-02-01T10:00:00Z',
  createdAt: '2026-02-01T10:00:00Z',
}

function page<T>(content: T[], size = 20) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

describe('ProjectListPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('shows real projects from the backend with a link to the details', async () => {
    server.use(
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(page([DISTRICT], 100)),
      ),
      http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(page([PROJECT]))),
    )

    renderWithProviders(<ProjectListPage />, { auth: AUTH })

    const link = await screen.findByRole('link', { name: PROJECT.title })
    expect(link).toHaveAttribute('href', `/projects/${PROJECT.id}`)
    expect(screen.getByText(PROJECT.code)).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()

    const table = screen.getByRole('table', {
      name: 'Government projects visible to you',
    })
    expect(within(table).getByText('Pune')).toBeInTheDocument()
    expect(screen.getByText('1 project visible to you')).toBeInTheDocument()
  })

  it('asks the backend for one district when the filter changes', async () => {
    const user = userEvent.setup()
    let lastUrl: string | null = null

    server.use(
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(page([DISTRICT], 100)),
      ),
      http.get(`${API_BASE_URL}/projects`, ({ request }) => {
        lastUrl = request.url
        return HttpResponse.json(page([PROJECT]))
      }),
    )

    renderWithProviders(<ProjectListPage />, { auth: AUTH })

    await screen.findByRole('link', { name: PROJECT.title })
    await user.selectOptions(screen.getByLabelText('District'), DISTRICT.id)

    await waitFor(() => {
      expect(lastUrl).not.toBeNull()
      const url = new URL(String(lastUrl))
      expect(url.searchParams.get('districtId')).toBe(DISTRICT.id)
      expect(url.searchParams.get('page')).toBe('0')
    })
  })

  it('shows an honest empty state when the backend returns no projects', async () => {
    server.use(
      http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json(page<ProjectResponse>([]))),
    )

    renderWithProviders(<ProjectListPage />, { auth: AUTH })

    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'A project appears here after a recommended proposal is approved.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the backend message when the list cannot be loaded', async () => {
    server.use(
      http.get(`${API_BASE_URL}/projects`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 403,
            error: 'Forbidden',
            message: 'You are not allowed to read projects.',
            path: '/api/v1/projects',
            fieldErrors: [],
          },
          { status: 403 },
        ),
      ),
    )

    renderWithProviders(<ProjectListPage />, { auth: AUTH })

    expect(await screen.findByText('You do not have access')).toBeInTheDocument()
    expect(
      screen.getByText('You do not have permission to do this.'),
    ).toBeInTheDocument()
  })
})
