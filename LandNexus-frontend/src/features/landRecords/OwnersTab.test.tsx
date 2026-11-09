import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { OwnersTab } from './OwnersTab'
import { API_BASE_URL } from '../../api/client'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { todayIso } from './dates'
import { HIDDEN_OWNER_LABEL } from './labels'
import {
  authWith,
  OWNERSHIP_MASKED,
  OWNERSHIP_NAMED,
  PARCEL,
} from './testFixtures'

const LANDOWNER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

describe('OwnersTab', () => {
  it('masks owner names when the role cannot read landowner data', async () => {
    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id/ownerships`, () =>
        HttpResponse.json([OWNERSHIP_MASKED]),
      ),
    )

    renderWithProviders(<OwnersTab parcel={PARCEL} />, {
      auth: authWith(['LAND_RECORD_READ']),
    })

    expect(await screen.findByText(HIDDEN_OWNER_LABEL)).toBeInTheDocument()
    expect(
      screen.getByText('Owner names are hidden for your role'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Add owner' })).not.toBeInTheDocument()
  })

  it('adds an owner by UUID when landowner search is not permitted', async () => {
    const user = userEvent.setup()
    let body: unknown = null

    server.use(
      http.post(
        `${API_BASE_URL}/land-records/parcels/:id/ownerships`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json(OWNERSHIP_NAMED, { status: 201 })
        },
      ),
    )

    renderWithProviders(<OwnersTab parcel={PARCEL} />, {
      auth: authWith(['LAND_RECORD_READ', 'LAND_RECORD_WRITE']),
    })

    const addButtons = await screen.findAllByRole('button', { name: 'Add owner' })
    await user.click(addButtons[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText('Search landowners')).not.toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/^Landowner ID/), LANDOWNER_ID)
    await user.type(within(dialog).getByLabelText(/^Share \(%\)/), '40')
    await user.selectOptions(within(dialog).getByLabelText(/^Basis/), 'SALE')
    await user.click(within(dialog).getByRole('button', { name: 'Add owner' }))

    await waitFor(() => {
      expect(body).toEqual({
        landownerId: LANDOWNER_ID,
        sharePercent: 40,
        basis: 'SALE',
        fromDate: todayIso(),
        remarks: null,
      })
    })
  })

  it('rejects a share that exceeds the unallocated percentage', async () => {
    const user = userEvent.setup()
    let posted = false

    server.use(
      http.get(`${API_BASE_URL}/land-records/parcels/:id/ownerships`, () =>
        HttpResponse.json([OWNERSHIP_MASKED]),
      ),
      http.post(`${API_BASE_URL}/land-records/parcels/:id/ownerships`, () => {
        posted = true
        return HttpResponse.json(OWNERSHIP_NAMED, { status: 201 })
      }),
    )

    renderWithProviders(<OwnersTab parcel={PARCEL} />, {
      auth: authWith(['LAND_RECORD_READ', 'LAND_RECORD_WRITE']),
    })

    const addButtons = await screen.findAllByRole('button', { name: 'Add owner' })
    await user.click(addButtons[0])

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^Landowner ID/), LANDOWNER_ID)
    await user.type(within(dialog).getByLabelText(/^Share \(%\)/), '70')
    await user.selectOptions(within(dialog).getByLabelText(/^Basis/), 'SALE')
    await user.click(within(dialog).getByRole('button', { name: 'Add owner' }))

    expect(await screen.findByText('The remaining share is 60%.')).toBeInTheDocument()
    expect(posted).toBe(false)
  })
})
