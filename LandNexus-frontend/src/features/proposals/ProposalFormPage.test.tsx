import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ProposalFormPage } from './ProposalFormPage'
import { API_BASE_URL } from '../../api/client'
import type {
  DepartmentResponse,
  DistrictResponse,
  StateResponse,
  TalukaResponse,
  VillageResponse,
} from '../../api/types'
import { TEST_USER } from '../../test/handlers'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'

const FORM_USER = {
  ...TEST_USER,
  permissions: [...TEST_USER.permissions, 'MASTER_DATA_READ'],
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
  createdAt: '',
  updatedAt: '',
}

const DEPARTMENT: DepartmentResponse = {
  id: '33333333-3333-3333-3333-333333333333',
  code: 'PWD',
  name: 'Public Works',
  status: 'ACTIVE',
  ministryId: '99999999-9999-9999-9999-999999999999',
  ministryName: 'Infrastructure',
  level: 'STATE',
  createdAt: '',
  updatedAt: '',
}

const STATE: StateResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'MH',
  name: 'Maharashtra',
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
}

const TALUKA: TalukaResponse = {
  id: '44444444-4444-4444-4444-444444444444',
  code: 'HAVELI',
  name: 'Haveli',
  status: 'ACTIVE',
  districtId: DISTRICT.id,
  districtName: DISTRICT.name,
  createdAt: '',
  updatedAt: '',
}

const VILLAGE_ONE: VillageResponse = {
  id: '55555555-5555-5555-5555-555555555555',
  code: 'V1',
  name: 'Village One',
  status: 'ACTIVE',
  talukaId: TALUKA.id,
  talukaName: TALUKA.name,
  createdAt: '',
  updatedAt: '',
}

const VILLAGE_TWO: VillageResponse = {
  id: '66666666-6666-6666-6666-666666666666',
  code: 'V2',
  name: 'Village Two',
  status: 'ACTIVE',
  talukaId: TALUKA.id,
  talukaName: TALUKA.name,
  createdAt: '',
  updatedAt: '',
}

function page<T>(content: T[], size = 100) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
  }
}

function useReferenceHandlers() {
  server.use(
    http.get(`${API_BASE_URL}/administration/my-districts`, () =>
      HttpResponse.json(page([DISTRICT])),
    ),
    http.get(`${API_BASE_URL}/administration/departments`, () =>
      HttpResponse.json(page([DEPARTMENT])),
    ),
    http.get(`${API_BASE_URL}/administration/states`, () =>
      HttpResponse.json(page([STATE])),
    ),
    http.get(`${API_BASE_URL}/administration/talukas`, () =>
      HttpResponse.json(page([TALUKA])),
    ),
    http.get(`${API_BASE_URL}/administration/villages`, () =>
      HttpResponse.json(page([VILLAGE_ONE, VILLAGE_TWO])),
    ),
  )
}

beforeEach(() => {
  resetReferenceCacheForTests()
})

describe('ProposalFormPage', () => {
  it('shows field errors before sending an incomplete draft', async () => {
    const user = userEvent.setup()
    useReferenceHandlers()

    renderWithProviders(<ProposalFormPage />, {
      auth: { status: 'authenticated', user: FORM_USER },
      initialEntries: ['/proposals/new'],
    })

    await screen.findByRole('heading', { name: 'New proposal' })
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('Select a project type.')).toBeInTheDocument()
    expect(screen.getByText('Select a district.')).toBeInTheDocument()
    expect(screen.getByText('Select a department.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one village.')).toBeInTheDocument()
  })

  it('creates a draft using the district, taluka and villages from the reference lists', async () => {
    const user = userEvent.setup()
    useReferenceHandlers()

    let receivedBody: unknown = null
    const created = {
      id: '77777777-7777-7777-7777-777777777777',
      proposalNumber: null,
      title: 'New school building',
      projectType: 'SCHOOL',
      status: 'DRAFT',
      versionNo: 0,
      stateId: STATE.id,
      districtId: DISTRICT.id,
      talukaId: TALUKA.id,
      departmentId: DEPARTMENT.id,
      lengthKm: null,
      estimatedLandAreaHa: 1.25,
      villageIds: [VILLAGE_ONE.id, VILLAGE_TWO.id],
      alignmentDescription: null,
      description: 'Build a new school for the village.',
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
      ownerUserId: TEST_USER.id,
      submittedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      projectCode: null,
      availableActions: ['SUBMIT'],
    }

    server.use(
      http.post(`${API_BASE_URL}/projects/proposals`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json(created, { status: 201 })
      }),
    )

    renderWithProviders(<ProposalFormPage />, {
      auth: { status: 'authenticated', user: FORM_USER },
      initialEntries: ['/proposals/new'],
    })

    await screen.findByRole('heading', { name: 'New proposal' })

    await user.type(screen.getByLabelText(/Title/), 'New school building')
    await user.selectOptions(screen.getByLabelText(/Project type/), 'SCHOOL')
    await user.selectOptions(screen.getByLabelText(/Department/), DEPARTMENT.id)
    await user.selectOptions(screen.getByLabelText(/District/), DISTRICT.id)

    const villageOne = await screen.findByRole('checkbox', { name: /Village One/ })
    const villageTwo = screen.getByRole('checkbox', { name: /Village Two/ })
    await user.click(villageOne)
    await user.click(villageTwo)

    await user.selectOptions(screen.getByLabelText('Taluka (optional)'), TALUKA.id)

    await user.type(screen.getByLabelText(/Estimated land area/), '1.25')
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Build a new school for the village.',
    )

    fireEvent.change(screen.getByLabelText(/Planned start date/), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(screen.getByLabelText(/Planned end date/), {
      target: { value: '2026-12-31' },
    })

    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(receivedBody).not.toBeNull())
    expect(receivedBody).toEqual({
      title: 'New school building',
      projectType: 'SCHOOL',
      districtId: DISTRICT.id,
      talukaId: TALUKA.id,
      departmentId: DEPARTMENT.id,
      lengthKm: null,
      estimatedLandAreaHa: 1.25,
      villageIds: [VILLAGE_ONE.id, VILLAGE_TWO.id],
      alignmentDescription: null,
      description: 'Build a new school for the village.',
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
    })
  })
})
