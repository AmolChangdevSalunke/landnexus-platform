import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { TEST_USER } from '../../test/handlers'
import { renderWithProviders } from '../../test/render'

function renderSidebar(permissions: string[], roles: string[] = ['CONSULTANT']) {
  return renderWithProviders(
    <Sidebar
      open
      collapsed={false}
      onClose={vi.fn()}
      onToggleCollapse={vi.fn()}
    />,
    {
      auth: {
        status: 'authenticated',
        user: { ...TEST_USER, permissions, roles },
      },
    },
  )
}

describe('Sidebar navigation permissions', () => {
  it('shows proposal links only when the user can read or create proposals', () => {
    renderSidebar(['PROPOSAL_CREATE', 'PROPOSAL_READ_OWN'])

    expect(screen.getByRole('link', { name: 'Proposals' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New proposal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Master data' })).not.toBeInTheDocument()
  })

  it('hides proposal links for a user without proposal permissions', () => {
    renderSidebar(['NOTIFICATION_READ'], ['CITIZEN'])

    expect(screen.queryByRole('link', { name: 'Proposals' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('shows administration links based on individual permissions', () => {
    renderSidebar(['MASTER_DATA_READ', 'USER_READ'], ['DISTRICT_ADMIN'])

    expect(screen.getByRole('link', { name: 'Master data' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Roles and permissions' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit trail' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Login history' })).not.toBeInTheDocument()
  })

  it('shows audit links only for AUDIT_READ', () => {
    renderSidebar(['AUDIT_READ'], ['AUDITOR'])

    expect(screen.getByRole('link', { name: 'Audit trail' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Login history' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('shows land parcel link only with LAND_RECORD_READ', () => {
    renderSidebar(['LAND_RECORD_READ'], ['LAND_RECORDS_OFFICER'])

    expect(screen.getByRole('link', { name: 'Land parcels' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Landowners' })).not.toBeInTheDocument()
  })

  it('shows landowner link only with LANDOWNER_READ', () => {
    renderSidebar(['LANDOWNER_READ'], ['REVENUE_OFFICER'])

    expect(screen.getByRole('link', { name: 'Landowners' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Land parcels' })).not.toBeInTheDocument()
  })

  it('shows acquisition links based on acquisition and survey permissions', () => {
    renderSidebar(['ACQUISITION_READ'], ['LAND_ACQUISITION_OFFICER'])

    expect(screen.getByRole('link', { name: 'Acquisition cases' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My surveys' })).not.toBeInTheDocument()
  })

  it('shows the survey worklist only with SURVEY_PERFORM', () => {
    renderSidebar(['SURVEY_PERFORM'], ['FIELD_OFFICER'])

    expect(screen.getByRole('link', { name: 'My surveys' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Acquisition cases' })).not.toBeInTheDocument()
  })

  it('always keeps My work and hides monitoring links without permissions', () => {
    renderSidebar([])

    expect(screen.getByRole('link', { name: 'My work' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Valuation and compensation/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Monitoring and MIS/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Monitoring dashboard' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'MIS reports' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'SLA and alerts' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Land records/ })).not.toBeInTheDocument()
  })

  it('shows monitoring links based on their individual permissions', () => {
    renderSidebar(['DASHBOARD_READ', 'REPORT_READ', 'SLA_READ'])

    expect(screen.getByRole('link', { name: 'Monitoring dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'MIS reports' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'SLA and alerts' })).toBeInTheDocument()
  })
})
