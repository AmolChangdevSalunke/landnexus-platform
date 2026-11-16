import type { LucideIcon } from 'lucide-react'
import {
  AlarmClock,
  AlertTriangle,
  BarChart3,
  Bell,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  Files,
  FolderKanban,
  History,
  IndianRupee,
  LayoutDashboard,
  Map,
  MapPinned,
  PlusCircle,
  Route,
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
        label: 'Workflow routing rules',
        to: '/admin/routing-rules',
        icon: Route,
        permissions: [PERMISSION.ROUTING_RULE_READ],
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
    label: 'Monitoring and MIS',
    items: [
      {
        label: 'Monitoring dashboard',
        to: '/monitoring',
        icon: BarChart3,
        permissions: [PERMISSION.DASHBOARD_READ],
        end: true,
      },
      {
        label: 'NLAMS progress',
        to: '/monitoring/nlams',
        icon: Route,
        permissions: [PERMISSION.DASHBOARD_READ],
      },
      {
        label: 'MIS reports',
        to: '/monitoring/reports',
        icon: FileSpreadsheet,
        permissions: [PERMISSION.REPORT_READ],
      },
      {
        label: 'SLA and alerts',
        to: '/monitoring/sla',
        icon: AlarmClock,
        permissions: [PERMISSION.SLA_READ],
      },
    ],
  },
]
