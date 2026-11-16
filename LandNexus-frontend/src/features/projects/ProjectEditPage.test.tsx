import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { ProjectEditPage } from './ProjectEditPage'
import { API_BASE_URL } from '../../api/client'
import type {
  DepartmentResponse,
  DistrictResponse,
  ProjectResponse,
  ProjectUpdateRequest,
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
  permissions: [...TEST_USER.permissions, 'MASTER_DATA_READ', 'PROJECT_MANAGE'],
}

const AUTH = {
  user: USER,
  accessToken: 'test-access-token',
  status: 'authenticated' as const,
  error: null,
}

const STATE: StateResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'MH',
  name: 'Maharashtra',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const DISTRICT: DistrictResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  code: 'PUNE',
  name: 'Pune',
  status: 'ACTIVE',
  stateId: STATE.id,
  stateName: STATE.name,
  divisionId: null,
  divisionName: null,
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

function page<T>(content: T[]) {
  return {
    content,
    page: 0,
    size: 100,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

describe('ProjectEditPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('saves corrected project details through PUT /projects/{id}', async () => {
    let body: ProjectUpdateRequest | null = null

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
      http.get(`${API_BASE_URL}/projects/${PROJECT.id}`, () => HttpResponse.json(PROJECT)),
      http.put(`${API_BASE_URL}/projects/${PROJECT.id}`, async ({ request }) => {
        body = (await request.json()) as ProjectUpdateRequest
        return HttpResponse.json({ ...PROJECT, title: body.title })
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/projects/:id/edit" element={<ProjectEditPage />} />
        <Route path="/projects/:id" element={<div>Project detail page</div>} />
      </Routes>,
      { auth: AUTH, initialEntries: [`/projects/${PROJECT.id}/edit`] },
    )

    expect(await screen.findByRole('heading', { name: 'Edit project' })).toBeInTheDocument()

    const title = screen.getByLabelText(/^Title/)
    await user.clear(title)
    await user.type(title, 'District hospital phase two')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Project detail page')).toBeInTheDocument()
    expect(body).toMatchObject({
      title: 'District hospital phase two',
      projectType: 'HOSPITAL',
      districtId: DISTRICT.id,
      talukaId: TALUKA.id,
      departmentId: DEPARTMENT.id,
      lengthKm: 2.5,
      estimatedLandAreaHa: 10,
      villageIds: [VILLAGE.id],
    })
  })

  it('does not offer editing for a closed project', async () => {
    server.use(
      http.get(`${API_BASE_URL}/projects/${PROJECT.id}`, () =>
        HttpResponse.json({ ...PROJECT, status: 'CLOSED' }),
      ),
    )

    renderWithProviders(
      <Routes>
        <Route path="/projects/:id/edit" element={<ProjectEditPage />} />
      </Routes>,
      { auth: AUTH, initialEntries: [`/projects/${PROJECT.id}/edit`] },
    )

    expect(
      await screen.findByRole('heading', { name: 'This project is closed' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Reopen the project first')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })
})
