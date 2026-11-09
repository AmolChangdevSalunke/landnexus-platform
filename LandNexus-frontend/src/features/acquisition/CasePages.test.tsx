import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { CaseDetailsPage } from './CaseDetailsPage'
import { CaseFormPage } from './CaseFormPage'
import { CaseListPage } from './CaseListPage'
import { API_BASE_URL } from '../../api/client'
import type { ProjectResponse } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, CASE, DISTRICT_ID, PROJECT_ID, STATE_ID, VILLAGE_ID } from './testFixtures'

const PROJECT: ProjectResponse = {
  id: PROJECT_ID,
  code: 'PRJ-2026-001',
  proposalId: '10101010-1010-4010-8010-101010101010',
  title: 'Approach road to the market yard',
  projectType: 'DISTRICT_ROAD',
  status: 'ACTIVE',
  stateId: STATE_ID,
  districtId: DISTRICT_ID,
  talukaId: null,
  departmentId: '30303030-3030-4030-8030-303030303030',
  lengthKm: 2.4,
  estimatedLandAreaHa: 1.8,
  villageIds: [VILLAGE_ID],
  ownerUserId: '40404040-4040-4040-8040-404040404040',
  approvedByUserId: '50505050-5050-4050-8050-505050505050',
  approvedAt: '2026-01-20T10:00:00Z',
  createdAt: '2026-01-10T10:00:00Z',
}

function renderList(permissions: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path="/acquisition" element={<CaseListPage />} />
    </Routes>,
    { auth: authWith(permissions), initialEntries: ['/acquisition'] },
  )
}

function renderDetails(permissions: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path="/acquisition/:id" element={<CaseDetailsPage />} />
    </Routes>,
    { auth: authWith(permissions), initialEntries: [`/acquisition/${CASE.id}`] },
  )
}

describe('acquisition case pages', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('lists the cases the backend returns and links to a case', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases`, () =>
        HttpResponse.json({
          content: [CASE],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    )

    renderList(['ACQUISITION_READ'])

    expect(await screen.findByText('ACQ-2026-000001')).toBeInTheDocument()
    expect(screen.getAllByText('Initiated').length).toBeGreaterThan(0)
    expect(screen.getByText('LARR Act 2013')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      `/acquisition/${CASE.id}`,
    )
    expect(screen.queryByRole('link', { name: 'New case' })).not.toBeInTheDocument()
  })

  it('offers case creation only with ACQUISITION_MANAGE', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases`, () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    )

    renderList(['ACQUISITION_READ', 'ACQUISITION_MANAGE'])

    expect(await screen.findByRole('link', { name: 'New case' })).toHaveAttribute(
      'href',
      '/acquisition/new',
    )
    expect(await screen.findByText('No acquisition cases yet')).toBeInTheDocument()
  })

  it('shows the case summary and every workflow section', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () => HttpResponse.json(CASE)),
    )

    renderDetails(['ACQUISITION_READ'])

    expect(await screen.findByRole('heading', { name: 'ACQ-2026-000001' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Villages and parcels' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Surveys' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Award' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Possession' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByText('Workflow actions')).toBeInTheDocument()
    expect(
      screen.getByText('You do not have an available workflow action in this stage.'),
    ).toBeInTheDocument()
  })

  it('creates a case from an active project and the selected framework', async () => {
    const user = userEvent.setup()
    let receivedBody: unknown = null

    server.use(
      http.get(`${API_BASE_URL}/projects`, () =>
        HttpResponse.json({
          content: [PROJECT],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.post(`${API_BASE_URL}/acquisition/cases`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(CASE)
      }),
    )

    renderWithProviders(
      <Routes>
        <Route path="/acquisition/new" element={<CaseFormPage />} />
        <Route path="/acquisition/:id" element={<div>Case details</div>} />
      </Routes>,
      {
        auth: authWith(['ACQUISITION_MANAGE', 'PROPOSAL_READ']),
        initialEntries: ['/acquisition/new'],
      },
    )

    expect(await screen.findByText('PRJ-2026-001 · Approach road to the market yard')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Approved project/), PROJECT_ID)
    await user.selectOptions(
      screen.getByLabelText(/Legal framework/),
      'NATIONAL_HIGHWAYS_ACT_1956',
    )
    await user.click(screen.getByRole('button', { name: 'Create case' }))

    await waitFor(() =>
      expect(receivedBody).toEqual({
        projectId: PROJECT_ID,
        framework: 'NATIONAL_HIGHWAYS_ACT_1956',
        frameworkNote: null,
        description: null,
      }),
    )
    expect(await screen.findByText('Case details')).toBeInTheDocument()
  })

  it('shows validation errors before creating a case', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${API_BASE_URL}/projects`, () =>
        HttpResponse.json({
          content: [PROJECT],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    )

    renderWithProviders(
      <Routes>
        <Route path="/acquisition/new" element={<CaseFormPage />} />
      </Routes>,
      {
        auth: authWith(['ACQUISITION_MANAGE', 'PROPOSAL_READ']),
        initialEntries: ['/acquisition/new'],
      },
    )

    expect(await screen.findByText('PRJ-2026-001 · Approach road to the market yard')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create case' }))

    expect(await screen.findByText('Select an approved project.')).toBeInTheDocument()
    expect(
      screen.getByText('Select the legal framework that applies.'),
    ).toBeInTheDocument()
  })

  it('does not fetch the project for a role without proposal read access', async () => {
    let projectRequested = false
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () => HttpResponse.json(CASE)),
      http.get(`${API_BASE_URL}/projects/:id`, () => {
        projectRequested = true
        return HttpResponse.json({})
      }),
    )

    renderDetails(['ACQUISITION_READ'])

    expect(await screen.findByRole('heading', { name: 'ACQ-2026-000001' })).toBeInTheDocument()
    expect(projectRequested).toBe(false)
    expect(screen.getByTitle(PROJECT_ID)).toBeInTheDocument()
  })
})
