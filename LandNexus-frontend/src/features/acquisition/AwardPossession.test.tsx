import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { AwardTab } from './AwardTab'
import { HistoryTab } from './HistoryTab'
import { ObjectionsTab } from './ObjectionsTab'
import { PossessionTab } from './PossessionTab'
import { API_BASE_URL } from '../../api/client'
import type { CaseStatus } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import {
  authWith,
  AWARD,
  CASE,
  CASE_PARCEL,
  HISTORY,
  NOTICE,
  OBJECTION_MASKED,
  POSSESSION,
} from './testFixtures'

const COMPENSATION_TEXT =
  'Compensation is recorded in the Valuation, Payments and R&R tabs when your role can read them.'

function caseWith(status: CaseStatus) {
  return { ...CASE, status }
}

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

function renderAward(status: CaseStatus, options: { formOpen?: boolean; onChanged?: () => void } = {}) {
  return renderWithProviders(
    <AwardTab
      acquisitionCase={{ ...caseWith(status), availableActions: ['DECLARE_AWARD'] }}
      reloadKey={0}
      formOpen={options.formOpen ?? false}
      onFormClose={vi.fn()}
      onChanged={options.onChanged ?? vi.fn()}
    />,
    { auth: authWith(['ACQUISITION_DECIDE']) },
  )
}

describe('acquisition Award tab', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('treats a missing award as an empty state and never shows money', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () => missingAward()),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () => HttpResponse.json([])),
    )

    renderAward('READY_FOR_AWARD')

    expect(await screen.findByText('No award declared yet')).toBeInTheDocument()
    expect(screen.getAllByText(COMPENSATION_TEXT).length).toBeGreaterThan(0)
    expect(screen.queryByText(/[₹$€]/)).not.toBeInTheDocument()
  })

  it('shows a declared award and its parcel lines', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () => HttpResponse.json(AWARD)),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () =>
        HttpResponse.json([NOTICE]),
      ),
    )

    renderAward('AWARD_DECLARED')

    expect(await screen.findByRole('heading', { name: 'Award AWARD/2026/17' })).toBeInTheDocument()
    expect(screen.getByText(COMPENSATION_TEXT)).toBeInTheDocument()
    expect(screen.getByText(AWARD.remarks as string)).toBeInTheDocument()
    expect(screen.queryByText(/[₹$€]/)).not.toBeInTheDocument()
  })

  it('rejects an award date before the objection deadline', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () => missingAward()),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () =>
        HttpResponse.json([NOTICE]),
      ),
    )

    renderAward('READY_FOR_AWARD', { formOpen: true })

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Award number/), 'AWARD/2026/18')
    fireEvent.change(within(dialog).getByLabelText(/Award date/), {
      target: { value: '2026-02-20' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Declare award' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The award date cannot be before the end of the objection period (25 Feb 2026).',
    )
  })
})

describe('acquisition Possession tab', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('offers possession entry only while the award is declared', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/possessions`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/parcels`, () =>
        HttpResponse.json([CASE_PARCEL]),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () => HttpResponse.json(AWARD)),
    )

    renderWithProviders(
      <PossessionTab
        acquisitionCase={caseWith('AWARD_DECLARED')}
        reloadKey={0}
        onChanged={vi.fn()}
      />,
      { auth: authWith(['ACQUISITION_MANAGE']) },
    )

    expect(await screen.findByText('0/1 parcels recorded')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Record possession' }).length,
    ).toBeGreaterThan(0)
  })

  it('lists recorded possession and does not offer entry outside the stage', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/possessions`, () =>
        HttpResponse.json([POSSESSION]),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/parcels`, () =>
        HttpResponse.json([CASE_PARCEL]),
      ),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () => HttpResponse.json(AWARD)),
    )

    renderWithProviders(
      <PossessionTab
        acquisitionCase={caseWith('POSSESSION_TAKEN')}
        reloadKey={0}
        onChanged={vi.fn()}
      />,
      { auth: authWith(['ACQUISITION_MANAGE']) },
    )

    expect(await screen.findByText('Physical possession')).toBeInTheDocument()
    expect(screen.getByText('1/1 parcels recorded')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record possession' })).not.toBeInTheDocument()
  })
})

describe('acquisition History tab', () => {
  it('shows the newest transition first with its action label', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/history`, () => HttpResponse.json(HISTORY)),
    )

    renderWithProviders(<HistoryTab acquisitionCase={CASE} reloadKey={0} />, {
      auth: authWith(['ACQUISITION_READ']),
    })

    const headings = await screen.findAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Start survey',
      'Case created',
    ])
    expect(screen.getByText('New acquisition case for the project.')).toBeInTheDocument()
  })
})

describe('acquisition Objections tab', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('masks the objector reference without LANDOWNER_READ', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/objections`, () =>
        HttpResponse.json([OBJECTION_MASKED]),
      ),
    )

    renderWithProviders(
      <ObjectionsTab acquisitionCase={caseWith('NOTIFICATION_ISSUED')} reloadKey={0} />,
      { auth: authWith(['ACQUISITION_READ']) },
    )

    expect(await screen.findByText('Hidden')).toBeInTheDocument()
    expect(screen.getByText(OBJECTION_MASKED.grounds)).toBeInTheDocument()
  })
})

describe('acquisition stage gates', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('does not load the award as an error when it does not exist', async () => {
    server.use(
      http.get(`${API_BASE_URL}/acquisition/cases/:id/award`, () => missingAward()),
      http.get(`${API_BASE_URL}/acquisition/cases/:id/notices`, () => HttpResponse.json([])),
    )

    const onChanged = vi.fn()
    renderAward('READY_FOR_AWARD', { onChanged })

    await waitFor(() =>
      expect(screen.queryByText('Could not load the award')).not.toBeInTheDocument(),
    )
    expect(onChanged).not.toHaveBeenCalled()
  })
})
