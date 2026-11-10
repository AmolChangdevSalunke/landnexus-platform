import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileText,
  Files,
  FolderKanban,
  History,
  IndianRupee,
  LayoutDashboard,
  Map,
  MapPinned,
  PlusCircle,
  ScrollText,
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
      {
        label: 'GIS map',
        to: '/gis',
        icon: Map,
        permissions: [PERMISSION.MASTER_DATA_READ],
      },
      {
        label: 'Conflict workspace',
        to: '/gis/conflicts',
        icon: AlertTriangle,
        permissions: [PERMISSION.GIS_READ],
      },
      {
        label: 'Village parcels',
        to: '/gis/villages',
        icon: MapPinned,
        permissions: [PERMISSION.GIS_READ],
      },
      { label: 'Notifications', to: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Land records',
    items: [
      {
        label: 'Land parcels',
        to: '/land/parcels',
        icon: MapPinned,
        permissions: [PERMISSION.LAND_RECORD_READ],
      },
      {
        label: 'Landowners',
        to: '/land/landowners',
        icon: Users,
        permissions: [PERMISSION.LANDOWNER_READ],
      },
      {
        label: 'Document register',
        to: '/land/documents',
        icon: Files,
        permissions: [PERMISSION.DOCUMENT_READ],
      },
    ],
  },
  {
    label: 'Land acquisition',
    items: [
      {
        label: 'Acquisition cases',
        to: '/acquisition',
        icon: MapPinned,
        permissions: [PERMISSION.ACQUISITION_READ],
      },
      {
        label: 'My surveys',
        to: '/acquisition/my-surveys',
        icon: ClipboardCheck,
        permissions: [PERMISSION.SURVEY_PERFORM],
      },
      {
        label: 'Notices register',
        to: '/acquisition/notices',
        icon: ScrollText,
        permissions: [PERMISSION.ACQUISITION_READ],
      },
    ],
  },
  {
    label: 'Compensation',
    items: [
      {
        label: 'Rate cards and rule sets',
        to: '/compensation/rules',
        icon: IndianRupee,
        permissions: [PERMISSION.VALUATION_READ],
      },
      {
        label: 'R&R benefit catalogue',
        to: '/compensation/rr/benefits',
        icon: Users,
        permissions: [PERMISSION.RR_CATALOGUE],
      },
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
      {
        label: 'Monitoring and MIS',
        to: '/roadmap/monitoring-mis',
        icon: BarChart3,
        planned: true,
      },
    ],
  },
]
