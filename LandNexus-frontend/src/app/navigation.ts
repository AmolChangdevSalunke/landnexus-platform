import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  History,
  IndianRupee,
  LayoutDashboard,
  Map,
  MapPinned,
  PlusCircle,
  Ruler,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { PERMISSION, PROPOSAL_READ_ANY } from '../utils/permissions'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  permissions?: string[]
  end?: boolean
  planned?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'My work', to: '/', icon: LayoutDashboard, end: true },
      {
        label: 'Proposals',
        to: '/proposals',
        icon: FileText,
        permissions: [...PROPOSAL_READ_ANY],
      },
      {
        label: 'New proposal',
        to: '/proposals/new',
        icon: PlusCircle,
        permissions: [PERMISSION.PROPOSAL_CREATE],
      },
      {
        label: 'Projects',
        to: '/projects',
        icon: FolderKanban,
        permissions: [...PROPOSAL_READ_ANY],
      },
      { label: 'Notifications', to: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Master data',
        to: '/admin/master/ministries',
        icon: Database,
        permissions: [PERMISSION.MASTER_DATA_READ],
      },
      {
        label: 'Users',
        to: '/admin/users',
        icon: Users,
        permissions: [PERMISSION.USER_READ],
      },
      {
        label: 'Roles and permissions',
        to: '/admin/roles',
        icon: ShieldCheck,
        permissions: [PERMISSION.USER_READ],
      },
      {
        label: 'Audit trail',
        to: '/admin/audit',
        icon: ClipboardList,
        permissions: [PERMISSION.AUDIT_READ],
      },
      {
        label: 'Login history',
        to: '/admin/logins',
        icon: History,
        permissions: [PERMISSION.AUDIT_READ],
      },
    ],
  },
  {
    label: 'Roadmap',
    items: [
      { label: 'Land records', to: '/roadmap/land-records', icon: MapPinned, planned: true },
      { label: 'Documents', to: '/roadmap/documents', icon: FileText, planned: true },
      {
        label: 'Land acquisition',
        to: '/roadmap/acquisition',
        icon: ClipboardCheck,
        planned: true,
      },
      { label: 'Field surveys', to: '/roadmap/field-surveys', icon: Ruler, planned: true },
      {
        label: 'Valuation and compensation',
        to: '/roadmap/valuation-compensation',
        icon: IndianRupee,
        planned: true,
      },
      { label: 'GIS map', to: '/roadmap/gis', icon: Map, planned: true },
      {
        label: 'Monitoring and MIS',
        to: '/roadmap/monitoring-mis',
        icon: BarChart3,
        planned: true,
      },
    ],
  },
]
