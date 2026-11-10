import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { DocumentRegisterPage } from './DocumentRegisterPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, DOCUMENT, PARCEL } from './testFixtures'

function renderRegister(initialEntries = ['/land/documents'], permissions = ['LAND_RECORD_READ', 'DOCUMENT_READ']) {
  return renderWithProviders(
    <Routes>
      <Route path="/land/documents" element={<DocumentRegisterPage />} />
    </Routes>,
    {
      auth: authWith(permissions),
      initialEntries,
    },
  )
}

describe('DocumentRegisterPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('finds a parcel and opens its document register', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels`, () =>
        HttpResponse.json({
          content: [PARCEL],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () =>
        HttpResponse.json(PARCEL),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id/documents`, () =>
        HttpResponse.json([DOCUMENT]),
      ),
    )

    renderRegister()

    expect(
      await screen.findByRole('heading', { name: 'Document register' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('123')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open register' }))

    expect(await screen.findByText('Selected parcel')).toBeInTheDocument()
    expect(await screen.findByText(DOCUMENT.title)).toBeInTheDocument()
  })

  it('opens the selected parcel from a deep link', async () => {
    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () =>
        HttpResponse.json(PARCEL),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id/documents`, () =>
        HttpResponse.json([DOCUMENT]),
      ),
    )

    renderRegister([`/land/documents?parcelId=${PARCEL.id}`])

    expect(await screen.findByText('Selected parcel')).toBeInTheDocument()
    expect(await screen.findByText(DOCUMENT.title)).toBeInTheDocument()
  })

  it('warns when the role cannot read documents', async () => {
    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels`, () =>
        HttpResponse.json({
          content: [PARCEL],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    )

    renderRegister(['/land/documents'], ['LAND_RECORD_READ'])

    expect(
      await screen.findByText('Document access is not assigned to your role'),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Open register' }),
    ).toBeDisabled()
  })
})
