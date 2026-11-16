import { beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { ProjectDetailsPage } from './ProjectDetailsPage'
import { API_BASE_URL } from '../../api/client'
import type {
  DepartmentResponse,
  DistrictResponse,
  ProjectResponse,
  StateResponse,
  TalukaResponse,
  VillageResponse,
} from '../../api/types'
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

const STATE: StateResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'MH',
  name: 'Maharashtra',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const DEPARTMENT: DepartmentResponse = {
  id: '33333333-3333-3333-3333-333333333333',
  code: 'PWD',
  name: 'Public Works Department',
  status: 'ACTIVE',
  ministryId: '77777777-7777-7777-7777-777777777777',
  ministryName: 'Infrastructure',
  level: 'STATE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const TALUKA: TalukaResponse = {
  id: '88888888-8888-8888-8888-888888888888',
  code: 'HVELI',
  name: 'Haveli',
  status: 'ACTIVE',
  districtId: DISTRICT.id,
  districtName: DISTRICT.name,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const VILLAGE: VillageResponse = {
  id: '44444444-4444-4444-4444-444444444444',
  code: 'WAGHOLI',
  name: 'Wagholi',
  status: 'ACTIVE',
  talukaId: TALUKA.id,
  talukaName: TALUKA.name,
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
  stateId: STATE.id,
  districtId: DISTRICT.id,
  talukaId: TALUKA.id,
  departmentId: DEPARTMENT.id,
  lengthKm: 2.5,
  estimatedLandAreaHa: 10,
  villageIds: [VILLAGE.id],
  ownerUserId: '55555555-5555-5555-5555-555555555555',
  approvedByUserId: '66666666-6666-6666-6666-666666666666',
  approvedAt: '2026-02-01T10:00:00Z',
  createdAt: '2026-02-01T10:00:00Z',
}

function page<T>(content: T[], size = 100) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:id" element={<ProjectDetailsPage />} />
    </Routes>,
    { auth: AUTH, initialEntries: [`/projects/${PROJECT.id}`] },
  )
}

describe('ProjectDetailsPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('shows real project details, affected villages and the originating proposal', async () => {
    server.use(
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(page([DISTRICT])),
      ),
      http.get(`${API_BASE_URL}/administration/states`, () =>
        HttpResponse.json(page([STATE])),
      ),
      http.get(`${API_BASE_URL}/administration/departments`, () =>
        HttpResponse.json(page([DEPARTMENT])),
      ),
      http.get(`${API_BASE_URL}/administration/talukas`, () =>
        HttpResponse.json(page([TALUKA])),
      ),
      http.get(`${API_BASE_URL}/administration/villages`, () =>
        HttpResponse.json(page([VILLAGE])),
      ),
      http.get(`${API_BASE_URL}/projects/${PROJECT.id}`, () =>
        HttpResponse.json(PROJECT),
      ),
    )

    renderDetails()

    expect(
      await screen.findByRole('heading', { name: PROJECT.title }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/PRJ-2026-000001/).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(await screen.findByText('Wagholi')).toBeInTheDocument()
    expect(screen.getByText('Affected villages (1)')).toBeInTheDocument()
    expect(screen.getByText('2.5 km')).toBeInTheDocument()
    expect(screen.getByText('10 ha')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Originating proposal' })).toHaveAttribute(
      'href',
      `/proposals/${PROJECT.proposalId}`,
    )
    expect(screen.getByRole('link', { name: 'Open proposal' })).toHaveAttribute(
      'href',
      `/proposals/${PROJECT.proposalId}`,
    )
    expect(
      screen.getByText(/This project was created automatically when its proposal was approved/),
    ).toBeInTheDocument()
  })

  it('shows a not-found state when the backend returns 404', async () => {
    server.use(
      http.get(`${API_BASE_URL}/projects/${PROJECT.id}`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 404,
            error: 'Not Found',
            message: 'Project not found.',
            path: `/api/v1/projects/${PROJECT.id}`,
            fieldErrors: [],
          },
          { status: 404 },
        ),
      ),
    )

    renderDetails()

    expect(await screen.findByText('Project not found')).toBeInTheDocument()
    expect(screen.getByText('Project not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to projects' })).toHaveAttribute(
      'href',
      '/projects',
    )
  })

  it('lets a project manager close and reopen the project', async () => {
    let status: 'ACTIVE' | 'CLOSED' = 'ACTIVE'
    const manageAuth = {
      ...AUTH,
      user: {
        ...USER,
        permissions: [...USER.permissions, 'PROJECT_MANAGE'],
      },
    }

    server.use(
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(page([DISTRICT])),
      ),
      http.get(`${API_BASE_URL}/administration/states`, () =>
        HttpResponse.json(page([STATE])),
      ),
      http.get(`${API_BASE_URL}/administration/departments`, () =>
        HttpResponse.json(page([DEPARTMENT])),
      ),
      http.get(`${API_BASE_URL}/administration/talukas`, () =>
        HttpResponse.json(page([TALUKA])),
      ),
      http.get(`${API_BASE_URL}/administration/villages`, () =>
        HttpResponse.json(page([VILLAGE])),
      ),
      http.get(`${API_BASE_URL}/projects/${PROJECT.id}`, () =>
        HttpResponse.json({ ...PROJECT, status }),
      ),
      http.post(`${API_BASE_URL}/projects/${PROJECT.id}/close`, () => {
        status = 'CLOSED'
        return HttpResponse.json({ ...PROJECT, status })
      }),
      http.post(`${API_BASE_URL}/projects/${PROJECT.id}/reopen`, () => {
        status = 'ACTIVE'
        return HttpResponse.json({ ...PROJECT, status })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
      </Routes>,
      { auth: manageAuth, initialEntries: [`/projects/${PROJECT.id}`] },
    )

    expect(await screen.findByRole('link', { name: 'Edit project' })).toHaveAttribute(
      'href',
      `/projects/${PROJECT.id}/edit`,
    )

    await user.click(screen.getByRole('button', { name: 'Close project' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close project' }),
    )

    expect(await screen.findByRole('button', { name: 'Reopen project' })).toBeInTheDocument()
    expect(screen.getByText('Project closed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reopen project' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reopen project' }),
    )

    expect(await screen.findByRole('button', { name: 'Close project' })).toBeInTheDocument()
  })
})
