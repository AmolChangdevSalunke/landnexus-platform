import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { AwardPrintPage } from './AwardPrintPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { authWith, AWARD, CASE } from './testFixtures'

function missingAward() {
  return HttpResponse.json(
    {
      timestamp: new Date().toISOString(),
      status: 404,
      error: 'Not Found',
      message: 'No award declared for this case',
      path: `/api/v1/acquisition/cases/${CASE.id}/award`,
      fieldErrors: [],
    },
    { status: 404 },
  )
}

function renderAwardLetter(caseId = CASE.id) {
  return renderWithProviders(
    <Routes>
      <Route path="/acquisition/:id/award/print" element={<AwardPrintPage />} />
    </Routes>,
    {
      auth: authWith(['ACQUISITION_READ']),
      initialEntries: [`/acquisition/${caseId}/award/print`],
    },
  )
}

describe('AwardPrintPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the award letter with its parcel lines and prints it', async () => {
    const user = userEvent.setup()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () =>
        HttpResponse.json(AWARD),
      ),
    )

    renderAwardLetter()

    expect(
      await screen.findByRole('heading', { name: 'Award AWARD/2026/17', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Declared on 1 Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('ACQ-2026-000001')).toBeInTheDocument()
    expect(screen.getByText(AWARD.remarks as string)).toBeInTheDocument()
    expect(screen.queryByText(/[₹$€]/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Print this award' }))

    expect(printSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Back to case' })).toHaveAttribute(
      'href',
      `/acquisition/${CASE.id}`,
    )
  })

  it('treats a missing award as an empty state, not an error', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () => missingAward()),
    )

    renderAwardLetter()

    expect(await screen.findByText('No award declared yet')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to case details' }),
    ).toHaveAttribute('href', `/acquisition/${CASE.id}`)
  })
})
