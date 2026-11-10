import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { ValuationDetailPage } from './ValuationDetailPage'
import { API_BASE_URL } from '../../api/client'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { formatMoney } from '../../utils/format'
import { authWith, CASE } from '../acquisition/testFixtures'
import { VALUATION } from './testFixtures'

function renderRecord() {
  return renderWithProviders(
    <Routes>
      <Route path="/compensation/valuations/:id" element={<ValuationDetailPage />} />
    </Routes>,
    {
      auth: authWith(['VALUATION_READ']),
      initialEntries: [`/compensation/valuations/${VALUATION.id}`],
    },
  )
}

describe('ValuationDetailPage', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
    server.use(
      http.get(`${API_BASE_URL}/compensation/valuations/:id`, () =>
        HttpResponse.json(VALUATION),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id`, () =>
        HttpResponse.json(CASE),
      ),
    )
  })

  it('shows the server breakdown and total without browser arithmetic', async () => {
    renderRecord()

    expect(await screen.findByText('Estimate version 1')).toBeInTheDocument()
    expect(await screen.findByText(new RegExp(CASE.caseNumber))).toBeInTheDocument()
    expect(screen.getByText('Land value')).toBeInTheDocument()
    expect(screen.getByText('1.25 ha × ₹1,250,000 per hectare')).toBeInTheDocument()
    expect(screen.getByText('Asset total included')).toBeInTheDocument()
    expect(screen.getByText('Total (calculated by the server)')).toBeInTheDocument()
    expect(
      screen.getAllByText(formatMoney(VALUATION.totalAmount)).length,
    ).toBeGreaterThan(0)
  })

  it('links back to the case and prints the record', async () => {
    const user = userEvent.setup()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    renderRecord()

    await screen.findByText('Estimate version 1')
    expect(screen.getByRole('link', { name: 'Back to case' })).toHaveAttribute(
      'href',
      `/acquisition/${VALUATION.caseId}`,
    )

    await user.click(screen.getByRole('button', { name: 'Print estimate' }))
    expect(printSpy).toHaveBeenCalledTimes(1)

    printSpy.mockRestore()
  })

  it('shows a not found state for a missing estimate', async () => {
    server.use(
      http.get(`${API_BASE_URL}/compensation/valuations/:id`, ({ request }) =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 404,
            error: 'Not Found',
            message: 'Valuation not found.',
            path: new URL(request.url).pathname,
            fieldErrors: [],
          },
          { status: 404 },
        ),
      ),
    )

    renderRecord()

    expect(await screen.findByText('Estimate not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to cases' })).toBeInTheDocument()
  })
})
