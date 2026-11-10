import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { VillageParcelsPage } from './VillageParcelsPage'
import { API_BASE_URL } from '../../api/client'
import type { FeatureCollection, MapProps } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, DISTRICT, TALUKA, VILLAGE } from '../landRecords/testFixtures'

const PARCEL_ONE = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [73.85, 19.87],
        [73.855, 19.87],
        [73.855, 19.875],
        [73.85, 19.875],
        [73.85, 19.87],
      ],
    ],
  },
  properties: {
    kind: 'PARCEL' as const,
    parcelId: 'parcel-one',
    gatNumber: '12',
    surveyNumber: null,
    classification: 'FOREST' as const,
    landUse: 'CULTIVATION' as const,
    areaHa: 0.5,
    inCase: false,
  },
}

const PARCEL_TWO = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [73.855, 19.87],
        [73.86, 19.87],
        [73.86, 19.875],
        [73.855, 19.875],
        [73.855, 19.87],
      ],
    ],
  },
  properties: {
    kind: 'PARCEL' as const,
    parcelId: 'parcel-two',
    gatNumber: '13',
    surveyNumber: null,
    classification: 'AGRICULTURAL_IRRIGATED' as const,
    landUse: 'CULTIVATION' as const,
    areaHa: 1,
    inCase: false,
  },
}

const VILLAGE_PARCELS: FeatureCollection<MapProps> = {
  type: 'FeatureCollection',
  features: [PARCEL_ONE, PARCEL_TWO],
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

/** Mirrors the master-data endpoints the village finder reads. */
function mockReferences() {
  server.use(
    http.get(`${API_BASE_URL}/administration/my-districts`, () =>
      HttpResponse.json(page([DISTRICT])),
    ),
    http.get(`${API_BASE_URL}/administration/states`, () =>
      HttpResponse.json(page([])),
    ),
    http.get(`${API_BASE_URL}/administration/talukas`, () =>
      HttpResponse.json(page([TALUKA])),
    ),
    http.get(`${API_BASE_URL}/administration/villages`, () =>
      HttpResponse.json(page([VILLAGE])),
    ),
  )
}

function serveVillageParcels() {
  server.use(
    http.get(`${API_BASE_URL}/gis/villages/:id/parcels`, () =>
      HttpResponse.json(VILLAGE_PARCELS),
    ),
  )
}

describe('VillageParcelsPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('draws every recorded boundary of the chosen village', async () => {
    const user = userEvent.setup()

    mockReferences()
    serveVillageParcels()

    renderWithProviders(<VillageParcelsPage />, {
      auth: authWith(['GIS_READ', 'MASTER_DATA_READ']),
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Village parcels' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('District'), DISTRICT.id)
    await screen.findByRole('option', { name: VILLAGE.name })
    await user.selectOptions(screen.getByLabelText('Village'), VILLAGE.id)

    expect(
      await screen.findByRole('img', {
        name: `Recorded parcel boundaries of village ${VILLAGE.name}`,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 with boundary')).toBeInTheDocument()
    expect(screen.getByText(/2 parcels · 1.5 ha of drawn boundaries/)).toBeInTheDocument()
  })

  it('shows the honest empty state when the village has no recorded boundaries', async () => {
    const user = userEvent.setup()

    mockReferences()
    // The default MSW handler answers with an empty FeatureCollection.

    renderWithProviders(<VillageParcelsPage />, {
      auth: authWith(['GIS_READ', 'MASTER_DATA_READ']),
    })

    await user.selectOptions(await screen.findByLabelText('District'), DISTRICT.id)
    await screen.findByRole('option', { name: VILLAGE.name })
    await user.selectOptions(screen.getByLabelText('Village'), VILLAGE.id)

    expect(
      await screen.findByText('No recorded boundaries in this village'),
    ).toBeInTheDocument()
  })

  it('falls back to a village UUID when master data is not readable', async () => {
    const user = userEvent.setup()

    serveVillageParcels()

    renderWithProviders(<VillageParcelsPage />, {
      auth: authWith(['GIS_READ']),
    })

    const input = await screen.findByLabelText(/^Village UUID/)
    await user.type(input, 'not-a-uuid')
    await user.click(screen.getByRole('button', { name: 'Show village parcels' }))

    expect(
      screen.getByText('Enter the village UUID, for example 3fa85f64-5717-4562-b3fc-2c963f66afa6.'),
    ).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, VILLAGE.id)
    await user.click(screen.getByRole('button', { name: 'Show village parcels' }))

    expect(
      await screen.findByRole('img', {
        name: `Recorded parcel boundaries of village ${VILLAGE.id}`,
      }),
    ).toBeInTheDocument()
  })
})
