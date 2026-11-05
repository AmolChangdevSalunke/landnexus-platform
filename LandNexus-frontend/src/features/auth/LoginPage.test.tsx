import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { LoginPage } from './LoginPage'
import { APP_TAGLINE } from '../../utils/strings'
import { renderWithProviders } from '../../test/render'

describe('LoginPage branding', () => {
  it('shows the logo and the full platform name without the old marketing copy', () => {
    renderWithProviders(<LoginPage />, { auth: { status: 'anonymous' } })

    expect(screen.getAllByAltText('LandNexus logo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('LandNexus').length).toBeGreaterThan(0)
    expect(screen.getAllByText(APP_TAGLINE).length).toBeGreaterThan(0)

    expect(
      screen.getByRole('heading', { name: 'Sign in to your workspace' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Secure sign in')).not.toBeInTheDocument()
    expect(screen.queryByText(/Unified digital governance/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Short-lived access tokens/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Authorised government users only/i),
    ).not.toBeInTheDocument()
  })
})
