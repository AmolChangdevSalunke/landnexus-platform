import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { ParcelDetailsPage } from './ParcelDetailsPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { HIDDEN_OWNER_LABEL } from './labels'
import { authWith, OWNERSHIP_MASKED, PARCEL } from './testFixtures'

function renderDetails(permissions: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path="/land/parcels/:id" element={<ParcelDetailsPage />} />
    </Routes>,
    {
      auth: authWith(permissions),
      initialEntries: [`/land/parcels/${PARCEL.id}`],
    },
  )
}

describe('ParcelDetailsPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('hides the documents tab and masks owners for a finance role', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () =>
        HttpResponse.json(PARCEL),
      ),
      http.get(`${API_BASE_URL}/land-records/parcels/:id/ownerships`, () =>
        HttpResponse.json([OWNERSHIP_MASKED]),
      ),
    )

    renderDetails(['LAND_RECORD_READ'])

    expect(await screen.findByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Documents' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit parcel' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Owners' }))

    expect(await screen.findByText(HIDDEN_OWNER_LABEL)).toBeInTheDocument()
    expect(
      screen.getByText('Owner names are hidden for your role'),
    ).toBeInTheDocument()
  })

  it('shows the documents tab when the role can read documents', async () => {
    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id`, () =>
        HttpResponse.json(PARCEL),
      ),
    )

    renderDetails(['LAND_RECORD_READ', 'DOCUMENT_READ'])

    expect(await screen.findByRole('tab', { name: 'Documents' })).toBeInTheDocument()
  })
})
