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

  it('always keeps My work and marks roadmap modules as planned', () => {
    renderSidebar([])

    expect(screen.getByRole('link', { name: 'My work' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Land records/ })).toBeInTheDocument()
    expect(screen.getAllByText('Planned').length).toBeGreaterThan(0)
  })
})
