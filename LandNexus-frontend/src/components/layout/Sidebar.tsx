import { NavLink } from 'react-router-dom'
import { PanelLeftClose, X } from 'lucide-react'
import { BrandLockup } from '../brand/BrandLockup'
import { NAV_GROUPS, type NavItem } from '../../app/navigation'
import { useAuth } from '../../features/auth/useAuth'
import { cn } from '../../utils/cn'

export function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
}: {
  open: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}) {
  const { canAny } = useAuth()

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.permissions || item.permissions.length === 0) {
        return true
      }
      return canAny(...item.permissions)
    }),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-navy-950/60 backdrop-blur-sm lg:hidden',
          open ? 'block' : 'hidden',
        )}
      />

      <aside
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-navy-900 text-slate-200 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0',
        )}
      >
        <div className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
          <BrandLockup
            tone="on-dark"
            orientation="horizontal"
            size="sm"
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto rounded-md p-1.5 text-slate-300 hover:bg-white/10 lg:hidden"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Close sidebar"
            title="Close sidebar"
            className="ml-auto hidden rounded-md p-1.5 text-slate-300 hover:bg-white/10 lg:inline-flex"
          >
            <PanelLeftClose aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <SidebarLink item={item} onNavigate={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          <p className="text-[11px] leading-5 text-slate-400">
            Access is enforced by the backend. Menu visibility is only a convenience.
          </p>
        </div>
      </aside>
    </>
  )
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-blue-600 font-semibold text-white'
            : 'text-slate-300 hover:bg-white/10 hover:text-white',
          item.planned && !isActive ? 'text-slate-400' : undefined,
        )
      }
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.planned ? (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          Planned
        </span>
      ) : null}
    </NavLink>
  )
}
