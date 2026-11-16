import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { DashboardPage } from './DashboardPage'
import { MisReportsPage } from './MisReportsPage'
import { NlamsPanel } from './NlamsPanel'
import { SlaMonitoringPage } from './SlaMonitoringPage'
import { API_BASE_URL } from '../../api/client'
import type { CurrentUser, DistrictResponse, StateResponse } from '../../api/types'
import { resetReferenceCacheForTests } from '../../hooks/useReferenceNames'
import { DASHBOARD_FIXTURE, TEST_USER } from '../../test/handlers'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'

const STATE: StateResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'MH',
  name: 'Maharashtra',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const DISTRICT: DistrictResponse = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'PUNE',
  name: 'Pune',
  status: 'ACTIVE',
  stateId: STATE.id,
  stateName: STATE.name,
  divisionId: null,
  divisionName: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function userWith(permissions: string[]): CurrentUser {
  return { ...TEST_USER, permissions }
}

function authFor(permissions: string[]) {
  return {
    user: userWith(permissions),
    accessToken: 'test-access-token',
    status: 'authenticated' as const,
    error: null,
  }
}

const DASHBOARD_AUTH = authFor(['DASHBOARD_READ'])
const REPORT_AUTH = authFor(['REPORT_READ', 'REPORT_EXPORT'])
const SLA_AUTH = authFor(['SLA_READ'])

function page<T>(content: T[], size = 100) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

describe('Monitoring dashboard', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('renders the KPIs and distributions returned by the dashboard API', async () => {
    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByText('Total projects')).toBeInTheDocument()
    expect(screen.getByText('Total proposals')).toBeInTheDocument()
    expect(screen.getByText('Land proposed')).toBeInTheDocument()
    expect(screen.getByText('Acquisition cases')).toBeInTheDocument()

    expect(screen.getByText('Land acquired')).toBeInTheDocument()
    expect(screen.getByText('Not available')).toBeInTheDocument()

    expect(screen.getByText('Compensation assessed')).toBeInTheDocument()
    expect(screen.getByText('Compensation disbursed')).toBeInTheDocument()
    expect(screen.getByText('R&R progress')).toBeInTheDocument()

    expect(screen.getAllByText('Proposals by status').length).toBe(1)
    expect(
      (await screen.findAllByText('Six-month activity', undefined, { timeout: 5000 })).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('table', { name: /district activity/i })).toBeInTheDocument()

    const districtTable = screen.getByRole('table', { name: /district activity/i })
    expect(within(districtTable).getByText('Pune')).toBeInTheDocument()
    expect(within(districtTable).getByText('Nagpur')).toBeInTheDocument()
  })

  it('refreshes every 30 seconds while the tab is visible', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE_URL}/monitoring/dashboard`, () => {
        calls += 1
        return HttpResponse.json(DASHBOARD_FIXTURE)
      }),
    )

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

      expect(await screen.findByText('Total projects')).toBeInTheDocument()
      await waitFor(() => expect(calls).toBe(1))

      act(() => {
        vi.advanceTimersByTime(30_000)
      })
      await waitFor(() => expect(calls).toBe(2))

      act(() => {
        vi.advanceTimersByTime(30_000)
      })
      await waitFor(() => expect(calls).toBe(3))
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the last successful refresh time as HH:mm:ss', async () => {
    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByText('Total projects')).toBeInTheDocument()
    expect(screen.getByText(/Updated at/)).toHaveTextContent(/\d{2}:\d{2}:\d{2}/)
  })

  it('keeps the last successful data visible when a refresh fails', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByText('Total projects')).toBeInTheDocument()

    server.use(
      http.get(`${API_BASE_URL}/monitoring/dashboard`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 500,
            error: 'Internal Server Error',
            message: 'Dashboard refresh failed',
            path: '/api/v1/monitoring/dashboard',
            fieldErrors: [],
          },
          { status: 500 },
        ),
      ),
    )

    await user.click(screen.getByRole('button', { name: /^refresh$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not refresh the dashboard/i)
    expect(alert).toHaveTextContent(/last successful refresh/i)
    expect(screen.getByText('Total projects')).toBeInTheDocument()
    expect(screen.getByText('Total proposals')).toBeInTheDocument()
  })

  it('refreshes manually when Refresh is clicked', async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.get(`${API_BASE_URL}/monitoring/dashboard`, () => {
        calls += 1
        return HttpResponse.json(DASHBOARD_FIXTURE)
      }),
    )

    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })
    expect(await screen.findByText('Total projects')).toBeInTheDocument()
    await waitFor(() => expect(calls).toBe(1))

    await user.click(screen.getByRole('button', { name: /^refresh$/i }))
    await waitFor(() => expect(calls).toBe(2))
  })

  it('labels simulated payments and never presents them as real money', async () => {
    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

    expect(
      await screen.findByText(/simulated payment/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/no real money transferred/i)).toBeInTheDocument()
    expect(await screen.findByText('Payment channel analytics')).toBeInTheDocument()
    expect(screen.getByText('PFMS · simulated')).toBeInTheDocument()
    expect(screen.getByText('DBT · simulated')).toBeInTheDocument()
  })

  it('shows restricted finance without inventing amounts when the role lacks valuation access', async () => {
    server.use(
      http.get(`${API_BASE_URL}/monitoring/dashboard`, () =>
        HttpResponse.json({ ...DASHBOARD_FIXTURE, finance: null }),
      ),
    )

    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByText('Compensation assessed')).toBeInTheDocument()
    expect(screen.getAllByText('Restricted').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/simulated payment/i)).not.toBeInTheDocument()
  })

  it('sends the selected state and district to the dashboard API', async () => {
    const seen: URL[] = []
    server.use(
      http.get(`${API_BASE_URL}/administration/states`, () => HttpResponse.json(page([STATE]))),
      http.get(`${API_BASE_URL}/administration/districts`, () =>
        HttpResponse.json(page([DISTRICT])),
      ),
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(page([DISTRICT])),
      ),
      http.get(`${API_BASE_URL}/monitoring/dashboard`, ({ request }) => {
        seen.push(new URL(request.url))
        return HttpResponse.json(DASHBOARD_FIXTURE)
      }),
    )

    renderWithProviders(<DashboardPage />, {
      auth: authFor(['DASHBOARD_READ', 'MASTER_DATA_READ']),
    })

    const stateSelect = await screen.findByLabelText('State')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Maharashtra' })).toBeInTheDocument())

    await userEvent.selectOptions(stateSelect, STATE.id)
    await waitFor(() => expect(seen.some((url) => url.searchParams.get('stateId') === STATE.id)).toBe(true))

    const districtSelect = await screen.findByLabelText('District')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Pune' })).toBeInTheDocument())
    await userEvent.selectOptions(districtSelect, DISTRICT.id)

    await waitFor(() =>
      expect(seen.some((url) => url.searchParams.get('districtId') === DISTRICT.id)).toBe(true),
    )
    await userEvent.selectOptions(screen.getByLabelText('Proposal status'), 'SUBMITTED')
    await waitFor(() =>
      expect(seen.some((url) => url.searchParams.get('proposalStatus') === 'SUBMITTED')).toBe(true),
    )
  })

  it('shows a retryable error when the dashboard request fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/monitoring/dashboard`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 500,
            error: 'Internal Server Error',
            message: 'Dashboard failed',
            path: '/api/v1/monitoring/dashboard',
            fieldErrors: [],
          },
          { status: 500 },
        ),
      ),
    )

    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not complete/i)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('shows honest empty states when the scope has no activity', async () => {
    server.use(
      http.get(`${API_BASE_URL}/monitoring/dashboard`, () =>
        HttpResponse.json({
          ...DASHBOARD_FIXTURE,
          districts: [],
          trend: [],
          proposals: { ...DASHBOARD_FIXTURE.proposals, byStatus: {}, total: 0 },
          projects: { ...DASHBOARD_FIXTURE.projects, byStatus: {}, total: 0 },
          acquisition: {
            ...DASHBOARD_FIXTURE.acquisition,
            casesByStatus: {},
            totalCases: 0,
            openCases: 0,
          },
        }),
      ),
    )

    renderWithProviders(<DashboardPage />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByText('No monthly activity in this scope yet.')).toBeInTheDocument()
    expect(screen.getAllByText('No records yet.').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('No district activity')).toBeInTheDocument()
  })

  it('renders a no-access page for a role without dashboard permission', async () => {
    renderWithProviders(<DashboardPage />, { auth: authFor(['PROPOSAL_READ_OWN']) })

    expect(await screen.findByText('No access')).toBeInTheDocument()
    expect(screen.getByText('403')).toBeInTheDocument()
  })
})

describe('MIS reports', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('runs the selected report and renders its rows', async () => {
    renderWithProviders(<MisReportsPage />, {
      auth: REPORT_AUTH,
      initialEntries: ['/monitoring/reports?report=ACQUISITION_CASES'],
    })

    expect(await screen.findByText('ACQ-2026-000001')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Case number' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Opened' })).toBeInTheDocument()
    expect(screen.getByText(/1 row\(s\)/)).toBeInTheDocument()
  })

  it('changes the report through the report selector', async () => {
    renderWithProviders(<MisReportsPage />, { auth: REPORT_AUTH })

    const reportSelect = await screen.findByLabelText('Report')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Compensation' })).toBeInTheDocument(),
    )

    await userEvent.selectOptions(reportSelect, 'COMPENSATION')

    expect(await screen.findByText('ACQ-2026-000001')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument()
  })

  it('exports the current report as a CSV download', async () => {
    const createObjectURL = vi.fn(() => 'blob:report-test')
    const revokeObjectURL = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL)

    renderWithProviders(<MisReportsPage />, { auth: REPORT_AUTH })

    const exportButton = await screen.findByRole('button', { name: /export csv/i })
    await waitFor(() => expect(exportButton).toBeEnabled())
    await userEvent.click(exportButton)

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report-test')
  })

  it('does not offer export to a role without REPORT_EXPORT', async () => {
    renderWithProviders(<MisReportsPage />, { auth: authFor(['REPORT_READ']) })

    const exportButton = await screen.findByRole('button', { name: /export csv/i })
    expect(exportButton).toBeDisabled()
    expect(
      screen.getByText(/your role can run reports but cannot export csv/i),
    ).toBeInTheDocument()
  })
})

describe('SLA and alerts', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('renders SLA counts, open items, forecast and escalation log', async () => {
    renderWithProviders(<SlaMonitoringPage />, { auth: SLA_AUTH })

    expect((await screen.findAllByText('On time')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Approaching deadline').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1)

    const openItems = screen.getByRole('table', { name: 'Open SLA items' })
    expect(within(openItems).getByText('BREACH')).toBeInTheDocument()
    expect(within(openItems).getByText('WARNING')).toBeInTheDocument()

    expect(screen.getByText('Breach risk forecast')).toBeInTheDocument()
    expect(screen.getByText(/not machine learning/i)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'At-risk open SLA items' })).toBeInTheDocument()

    expect(screen.getByText('Escalation log')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'SLA escalation log' })).toBeInTheDocument()
  })

  it('explains when the role cannot read SLA data', async () => {
    renderWithProviders(<SlaMonitoringPage />, { auth: authFor(['DASHBOARD_READ']) })

    expect(await screen.findByText(/needs the SLA_READ permission/i)).toBeInTheDocument()
  })

  it('shows an error state when the SLA request fails', async () => {
    server.use(
      http.get(`${API_BASE_URL}/monitoring/sla`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 500,
            error: 'Internal Server Error',
            message: 'SLA failed',
            path: '/api/v1/monitoring/sla',
            fieldErrors: [],
          },
          { status: 500 },
        ),
      ),
    )

    renderWithProviders(<SlaMonitoringPage />, { auth: SLA_AUTH })

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not complete/i)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

describe('NLAMS progress', () => {
  beforeEach(() => {
    resetReferenceCacheForTests()
  })

  it('renders each project with its stage, progress and simulated payments', async () => {
    renderWithProviders(<NlamsPanel />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByText('Pune bypass widening')).toBeInTheDocument()
    expect(screen.getByText('Nagpur water pipeline')).toBeInTheDocument()
    expect(screen.getByText('Project progress')).toBeInTheDocument()

    const progress = screen.getByRole('progressbar', { name: /Pune bypass widening progress/i })
    expect(progress).toHaveAttribute('aria-valuenow', '60')
    expect(progress).toHaveAttribute('aria-valuetext', '60 percent')
    expect(screen.getAllByText('60%').length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText(/SIMULATED PAYMENT/i)).toBeInTheDocument()
    expect(screen.getByText(/no real money moved/i)).toBeInTheDocument()
    expect(screen.getByText(/Updated at/i)).toBeInTheDocument()
    expect(screen.getByText(/Updated at/i)).toHaveTextContent(/\d{2}:\d{2}:\d{2}/)
    expect(screen.getByText(/Auto-refreshes every 30 seconds/i)).toBeInTheDocument()
  })

  it('shows the server error message and a retry button', async () => {
    server.use(
      http.get(`${API_BASE_URL}/monitoring/nlams`, () =>
        HttpResponse.json(
          {
            timestamp: new Date().toISOString(),
            status: 500,
            error: 'Internal Server Error',
            message: 'NLAMS failed',
            path: '/api/v1/monitoring/nlams',
            fieldErrors: [],
          },
          { status: 500 },
        ),
      ),
    )

    renderWithProviders(<NlamsPanel />, { auth: DASHBOARD_AUTH })

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not complete/i)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
