import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MyWorkPage } from './MyWorkPage'
import { API_BASE_URL } from '../../api/client'
import { TEST_USER } from '../../test/handlers'
import { server } from '../../test/server'
import { renderWithProviders } from '../../test/render'

const ADMIN_USER = {
  ...TEST_USER,
  roles: ['SUPER_ADMIN'],
  permissions: [
    'PROPOSAL_CREATE',
    'PROPOSAL_READ_OWN',
    'MASTER_DATA_READ',
    'USER_READ',
    'AUDIT_READ',
    'NOTIFICATION_READ',
  ],
}

const DISTRICT_USER = {
  ...TEST_USER,
  roles: ['DISTRICT_ADMIN'],
  permissions: ['PROPOSAL_READ_OWN', 'MASTER_DATA_READ'],
}

function districtPage() {
  return {
    content: [
      {
        id: 'district-pune',
        code: 'PUNE',
        name: 'Pune',
        status: 'ACTIVE',
        stateId: 'state-mh',
        stateName: 'Maharashtra',
        divisionId: 'division-pune',
        divisionName: 'Pune',
        createdAt: '',
        updatedAt: '',
      },
    ],
    page: 0,
    size: 100,
    totalElements: 1,
    totalPages: 1,
  }
}

describe('MyWorkPage', () => {
  it('renders the government workspace with live account data only', async () => {
    renderWithProviders(<MyWorkPage />, {
      auth: { status: 'authenticated', user: ADMIN_USER },
    })

    expect(screen.getByRole('heading', { level: 1, name: 'My work' })).toBeInTheDocument()

    // Greeting and workflow shortcuts live in the app header, not in page tiles.
    expect(screen.queryByText(/Good (morning|afternoon|evening)/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open proposals' })).not.toBeInTheDocument()

    // National scope shows the India map; identify it by its accessible label.
    expect(
      await screen.findByRole('img', { name: /Map of India showing states/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Quick actions')).toBeInTheDocument()
    expect(screen.getByText('Access and scope')).toBeInTheDocument()
    expect(screen.getByText('Platform modules')).toBeInTheDocument()
    expect(screen.getByText('Implemented')).toBeInTheDocument()
    expect(screen.getByText('Planned capabilities')).toBeInTheDocument()

    // Implemented modules must link to their live screens, not the roadmap.
    expect(screen.getByRole('link', { name: /Proposals and approval/ })).toHaveAttribute(
      'href',
      '/proposals',
    )
    expect(screen.getByRole('link', { name: /Valuation and compensation/ })).toHaveAttribute(
      'href',
      '/monitoring/compensation',
    )
    expect(screen.getByRole('link', { name: /Monitoring and MIS/ })).toHaveAttribute(
      'href',
      '/monitoring',
    )
    expect(screen.getByRole('link', { name: /PFMS and DBT payments/ })).toHaveAttribute(
      'href',
      '/roadmap/pfms-dbt',
    )

    // The removed summary tiles must not come back as placeholder statistics.
    expect(screen.queryByText('Assigned roles')).not.toBeInTheDocument()
    expect(screen.queryByText('Permissions granted')).not.toBeInTheDocument()
    expect(screen.queryByText('Districts in scope')).not.toBeInTheDocument()
    expect(screen.queryByText('Unread notifications')).not.toBeInTheDocument()

    // Administration links appear only because the test user has those permissions.
    expect(screen.getByRole('link', { name: 'Master data' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit trail' })).toBeInTheDocument()
  })

  it('zooms the map to the only district in scope', async () => {
    server.use(
      http.get(`${API_BASE_URL}/administration/my-districts`, () =>
        HttpResponse.json(districtPage()),
      ),
    )

    renderWithProviders(<MyWorkPage />, {
      auth: { status: 'authenticated', user: DISTRICT_USER },
    })

    expect(
      await screen.findByRole('img', {
        name: 'Map of Pune district in Maharashtra showing ongoing projects',
      }),
    ).toBeInTheDocument()
  })
})
