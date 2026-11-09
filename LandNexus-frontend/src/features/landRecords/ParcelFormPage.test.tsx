import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ParcelFormPage } from './ParcelFormPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, DISTRICT, PARCEL, TALUKA, VILLAGE } from './testFixtures'

function page<T>(content: T[], size = 100) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

describe('ParcelFormPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('creates a parcel with the values entered by the user', async () => {
    const user = userEvent.setup()
    let body: unknown = null

    server.use(
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(page([DISTRICT])),
      ),
      http.get(`${API_BASE_URL}/administration/talukas`, () =>
        HttpResponse.json(page([TALUKA])),
      ),
      http.get(`${API_BASE_URL}/administration/villages`, () =>
        HttpResponse.json(page([VILLAGE])),
      ),
      http.post(`${API_BASE_URL}/land-records/parcels`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(PARCEL, { status: 201 })
      }),
    )

    renderWithProviders(<ParcelFormPage />, {
      auth: authWith(['LAND_RECORD_READ', 'LAND_RECORD_WRITE', 'MASTER_DATA_READ']),
    })

    await screen.findByRole('option', { name: DISTRICT.name })
    await user.selectOptions(screen.getByLabelText(/^District/), DISTRICT.id)

    await screen.findByRole('option', { name: TALUKA.name })
    await user.selectOptions(screen.getByLabelText(/^Taluka/), TALUKA.id)

    await screen.findByRole('option', { name: VILLAGE.name })
    await user.selectOptions(screen.getByLabelText(/^Village/), VILLAGE.id)

    await user.type(screen.getByLabelText('Gat number'), '123')
    await user.type(screen.getByLabelText(/^Area \(ha\)/), '1.25')
    await user.selectOptions(
      screen.getByLabelText(/^Classification/),
      'AGRICULTURAL_IRRIGATED',
    )
    await user.selectOptions(screen.getByLabelText(/^Land use/), 'CULTIVATION')

    await user.click(screen.getByRole('button', { name: 'Create parcel' }))

    await waitFor(() => {
      expect(body).toEqual({
        villageId: VILLAGE.id,
        gatNumber: '123',
        surveyNumber: null,
        subdivisionNumber: null,
        areaHa: 1.25,
        classification: 'AGRICULTURAL_IRRIGATED',
        landUse: 'CULTIVATION',
      })
    })
  })

  it('blocks submission until the required parcel fields are present', async () => {
    const user = userEvent.setup()
    let posted = false

    server.use(
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(page([DISTRICT])),
      ),
      http.post(`${API_BASE_URL}/land-records/parcels`, () => {
        posted = true
        return HttpResponse.json(PARCEL, { status: 201 })
      }),
    )

    renderWithProviders(<ParcelFormPage />, {
      auth: authWith(['LAND_RECORD_READ', 'LAND_RECORD_WRITE', 'MASTER_DATA_READ']),
    })

    await screen.findByRole('option', { name: DISTRICT.name })
    await user.click(screen.getByRole('button', { name: 'Create parcel' }))

    expect(
      await screen.findAllByText('Enter at least a Gat number or a Survey number.'),
    ).toHaveLength(2)
    expect(screen.getByText('Enter the area in hectares.')).toBeInTheDocument()
    expect(screen.getByText('Select a land classification.')).toBeInTheDocument()
    expect(posted).toBe(false)
  })
})
