import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/client'
import type { ValuationResponse } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { formatMoney } from '../../utils/format'
import { authWith, CASE, CASE_PARCEL } from '../acquisition/testFixtures'
import { validateComponentDrafts } from './ComponentBuilder'
import { PaymentsTab } from './PaymentsTab'
import { RrTab } from './RrTab'
import { ValuationTab } from './ValuationTab'
import {
  AWARD as COMPENSATION_AWARD,
  COMPENSATION_SUMMARY,
  PAYMENT,
  PAYMENT_EVENT,
  PAYMENT_SUMMARY,
  RR_CASE,
  VALUATION,
} from './testFixtures'

function valuationHandlers(valuation: ValuationResponse = VALUATION) {
  return [
    http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () =>
      HttpResponse.json(COMPENSATION_AWARD),
    ),
    http.get(`${API_BASE_URL}/compensation/cases/:id/valuations`, () =>
      HttpResponse.json([valuation]),
    ),
    http.get(`${API_BASE_URL}/compensation/cases/:id/compensation-summary`, () =>
      HttpResponse.json(COMPENSATION_SUMMARY),
    ),
    http.get(`${API_BASE_URL}/compensation/cases/:id/parcels/:caseParcelId/assets`, () =>
      HttpResponse.json([]),
    ),
  ]
}

describe('compensation money and estimate breakdown', () => {
  it('formats money as Indian rupees without doing arithmetic', () => {
    const expected = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(1612500)
    expect(formatMoney(1612500)).toBe(expected)
    expect(formatMoney(null)).toBe('—')
  })

  it('renders the server breakdown, basis and total', async () => {
    resetReferenceCacheForTests()
    server.use(...valuationHandlers())

    renderWithProviders(
      <ValuationTab acquisitionCase={CASE} reloadKey={0} />,
      { auth: authWith(['VALUATION_READ', 'VALUATION_MANAGE']) },
    )

    expect(await screen.findByText('Land value')).toBeInTheDocument()
    expect(screen.getByText('1.25 ha × ₹1,250,000 per hectare')).toBeInTheDocument()
    expect(screen.getByText('Recorded assets on the parcel')).toBeInTheDocument()
    expect(screen.getByText('Total (calculated by the server)')).toBeInTheDocument()
    expect(screen.getAllByText(formatMoney(VALUATION.totalAmount)).length).toBeGreaterThan(0)
  })

  it('shows only the buttons the server allows in availableActions', async () => {
    resetReferenceCacheForTests()
    server.use(
      ...valuationHandlers({
        ...VALUATION,
        status: 'SUBMITTED',
        availableActions: ['APPROVE'],
      }),
    )

    renderWithProviders(
      <ValuationTab acquisitionCase={CASE} reloadKey={0} />,
      { auth: authWith(['VALUATION_READ', 'VALUATION_MANAGE', 'VALUATION_APPROVE']) },
    )

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument()
  })
})

describe('rule set component builder validation', () => {
  it('requires exactly one LAND_VALUE component', () => {
    const errors = validateComponentDrafts([
      { code: 'LAND_A', name: 'Land A', type: 'LAND_VALUE', factor: '1', baseCodes: [] },
      { code: 'LAND_B', name: 'Land B', type: 'LAND_VALUE', factor: '1', baseCodes: [] },
    ])
    expect(errors).toContain('A rule set needs exactly one LAND_VALUE component.')
  })

  it('allows a percentage to refer only to earlier codes', () => {
    const errors = validateComponentDrafts([
      { code: 'LAND_BASE', name: 'Land', type: 'LAND_VALUE', factor: '1', baseCodes: [] },
      {
        code: 'SOLATIUM',
        name: 'Solatium',
        type: 'PERCENT_OF',
        factor: '100',
        baseCodes: ['LATER'],
      },
      { code: 'LATER', name: 'Later', type: 'FIXED_PER_HECTARE', factor: '10', baseCodes: [] },
    ])
    expect(errors).toContain('SOLATIUM: LATER must be an earlier component.')
  })

  it('accepts a valid ordered rule set', () => {
    const errors = validateComponentDrafts([
      { code: 'LAND_BASE', name: 'Land', type: 'LAND_VALUE', factor: '1', baseCodes: [] },
      {
        code: 'SOLATIUM',
        name: 'Solatium',
        type: 'PERCENT_OF',
        factor: '100',
        baseCodes: ['LAND_BASE'],
      },
    ])
    expect(errors).toEqual([])
  })
})

describe('simulated payments', () => {
  function paymentHandlers() {
    return [
      http.get(`${API_BASE_URL}/compensation/cases/:id/payments`, () =>
        HttpResponse.json([PAYMENT]),
      ),
      http.get(`${API_BASE_URL}/compensation/cases/:id/payment-summary`, () =>
        HttpResponse.json(PAYMENT_SUMMARY),
      ),
      http.get(`${API_BASE_URL}/compensation/cases/:id/valuations`, () =>
        HttpResponse.json([VALUATION]),
      ),
      http.get(`${API_BASE_URL}/compensation/payments/:id/events`, () =>
        HttpResponse.json([PAYMENT_EVENT]),
      ),
    ]
  }

  it('always shows the SIMULATED banner and action labels from availableActions', async () => {
    resetReferenceCacheForTests()
    server.use(...paymentHandlers())

    renderWithProviders(
      <PaymentsTab acquisitionCase={CASE} reloadKey={0} />,
      { auth: authWith(['PAYMENT_READ', 'PAYMENT_RELEASE']) },
    )

    expect(
      await screen.findByText('SIMULATED PAYMENTS: no real money is moved'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Release (simulated)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Simulate confirmation' })).not.toBeInTheDocument()
  })

  it('loads the payment events on demand', async () => {
    const user = userEvent.setup()
    resetReferenceCacheForTests()
    server.use(...paymentHandlers())

    renderWithProviders(
      <PaymentsTab acquisitionCase={CASE} reloadKey={0} />,
      { auth: authWith(['PAYMENT_READ', 'PAYMENT_RELEASE']) },
    )

    await user.click(await screen.findByRole('button', { name: 'History' }))
    expect(await screen.findByText('Payment events')).toBeInTheDocument()
    expect(await screen.findByText(PAYMENT_EVENT.event)).toBeInTheDocument()
    expect(screen.getByText(/by finance\.one/)).toBeInTheDocument()
  })

  it('never renders a bank or account field', async () => {
    resetReferenceCacheForTests()
    server.use(...paymentHandlers())

    const { container } = renderWithProviders(
      <PaymentsTab acquisitionCase={CASE} reloadKey={0} />,
      { auth: authWith(['PAYMENT_READ', 'PAYMENT_RELEASE']) },
    )

    await screen.findByText('SIMULATED PAYMENTS: no real money is moved')
    const fields = Array.from(
      container.querySelectorAll('input, textarea, select, [name], [id]'),
    )
    const names = fields
      .map((field) =>
        [
          field.getAttribute('name'),
          field.getAttribute('id'),
          field.getAttribute('aria-label'),
          field.getAttribute('placeholder'),
        ]
          .filter(Boolean)
          .join(' '),
      )
      .join(' ')
    expect(names).not.toMatch(/bank|account|ifsc|caste|religion/i)
  })
})

describe('R&R family screen', () => {
  it('shows the family status and never asks for a sensitive attribute', async () => {
    const user = userEvent.setup()
    resetReferenceCacheForTests()
    server.use(
      http.get(`${API_BASE_URL}/compensation/cases/:id/rr-cases`, () =>
        HttpResponse.json([RR_CASE]),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/parcels`, () =>
        HttpResponse.json([{ ...CASE_PARCEL, owners: [{ landownerId: RR_CASE.landownerId, sharePercent: 100 }] }]),
      ),
    )

    const { container } = renderWithProviders(
      <RrTab acquisitionCase={CASE} reloadKey={0} />,
      { auth: authWith(['RR_READ', 'RR_MANAGE', 'RR_APPROVE']) },
    )

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent === 'Lost their home · Livelihood not lost',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(RR_CASE.notes as string)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Identify family' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Lost their home')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Lost their livelihood')).toBeInTheDocument()

    const fields = Array.from(container.querySelectorAll('input, textarea, select'))
    const names = fields
      .map((field) => [field.getAttribute('name'), field.getAttribute('id')].filter(Boolean).join(' '))
      .join(' ')
    expect(names).not.toMatch(/caste|religion|bank|account/i)
  })
})
