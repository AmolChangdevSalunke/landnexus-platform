import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PERMISSION } from '../../utils/permissions'
import { cn } from '../../utils/cn'

interface MonitoringTab {
  to: string
  label: string
  permissions: string[]
  end?: boolean
}

const TABS: MonitoringTab[] = [
  { to: '/monitoring', label: 'Overview', permissions: [PERMISSION.DASHBOARD_READ], end: true },
  { to: '/monitoring/projects', label: 'Projects', permissions: [PERMISSION.DASHBOARD_READ] },
  { to: '/monitoring/nlams', label: 'NLAMS progress', permissions: [PERMISSION.DASHBOARD_READ] },
  { to: '/monitoring/geography', label: 'Districts and states', permissions: [PERMISSION.DASHBOARD_READ] },
  { to: '/monitoring/lifecycle', label: 'Acquisition lifecycle', permissions: [PERMISSION.DASHBOARD_READ] },
  { to: '/monitoring/compensation', label: 'Compensation', permissions: [PERMISSION.DASHBOARD_READ] },
  { to: '/monitoring/reports', label: 'MIS reports', permissions: [PERMISSION.REPORT_READ] },
  { to: '/monitoring/sla', label: 'SLA and alerts', permissions: [PERMISSION.SLA_READ] },
]

/** URL-driven section tabs shared by every monitoring screen. */
export function MonitoringTabs() {
  const { canAny } = useAuth()
  const visible = TABS.filter((tab) => canAny(...tab.permissions))

  if (visible.length <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Monitoring sections"
      className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-1"
    >
      {visible.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
