import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  FileText,
  LogOut,
  MapPinned,
  Menu,
  PanelLeftOpen,
  UserRound,
} from 'lucide-react'
import { Breadcrumbs } from '../ui/Breadcrumbs'
import { LinkButton } from '../ui/LinkButton'
import { getBreadcrumbItems } from '../../app/breadcrumbs'
import { useAppDispatch } from '../../app/hooks'
import { useAuth } from '../../features/auth/useAuth'
import { useDistrictCount } from '../../features/auth/useDistrictCount'
import { useUnreadCount } from '../../features/notifications/useUnreadCount'
import { logout } from '../../features/auth/authSlice'
import { NotificationsMenu } from '../../features/notifications/NotificationsMenu'
import { PROPOSAL_READ_ANY } from '../../utils/permissions'
import { formatRoleList } from '../../utils/strings'

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return 'LN'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 17) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

const todayFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' })

export function Header({
  onOpenMenu,
  onExpandSidebar,
  sidebarCollapsed,
}: {
  onOpenMenu: () => void
  onExpandSidebar: () => void
  sidebarCollapsed: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { user, canAny } = useAuth()
  const unread = useUnreadCount()
  const districts = useDistrictCount()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!user) {
    return null
  }

  const displayName = user.fullName || user.username
  const primaryRole = formatRoleList(user.roles)
  const isHome = location.pathname === '/'
  const canReadProposals = canAny(...PROPOSAL_READ_ANY)

  async function handleLogout() {
    setMenuOpen(false)
    await dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-navy-900 text-white shadow-sm">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-200 hover:bg-white/10 lg:hidden"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>

        {sidebarCollapsed ? (
          <button
            type="button"
            onClick={onExpandSidebar}
            aria-label="Open sidebar"
            title="Open sidebar"
            className="hidden rounded-lg p-2 text-slate-200 hover:bg-white/10 lg:inline-flex"
          >
            <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          {isHome ? (
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200">
                {todayFormatter.format(new Date())}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold tracking-tight text-white sm:text-base">
                {greeting()}, {user.username}
              </p>
            </div>
          ) : (
            <Breadcrumbs items={getBreadcrumbItems(location.pathname)} tone="dark" />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isHome && canReadProposals ? (
            <LinkButton
              to="/proposals"
              variant="onDark"
              size="sm"
              aria-label="Open proposals"
              title="Open proposals"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
            </LinkButton>
          ) : null}

          <NotificationsMenu unread={unread} />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-white/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white ring-1 ring-white/20">
                {initials(displayName)}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-40 truncate text-sm font-semibold text-white">
                  {displayName}
                </span>
                <span className="block max-w-40 truncate text-xs text-slate-300">
                  {primaryRole}
                </span>
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              >
                <div className="border-b border-slate-100 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
                      {initials(displayName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900">{displayName}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">@{user.username}</p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <dt className="flex w-20 shrink-0 items-center gap-1 text-slate-500">
                        <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                        Roles
                      </dt>
                      <dd className="text-slate-700">{formatRoleList(user.roles)}</dd>
                    </div>
                    {districts.enabled ? (
                      <div className="flex items-start gap-2">
                        <dt className="flex w-20 shrink-0 items-center gap-1 text-slate-500">
                          <MapPinned aria-hidden="true" className="h-3.5 w-3.5" />
                          Districts
                        </dt>
                        <dd className="text-slate-700">
                          {districts.isLoading ? 'Loading…' : (districts.total ?? '—')}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
