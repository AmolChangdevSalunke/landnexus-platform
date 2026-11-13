import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileSearch,
  FileText,
  Files,
  FolderKanban,
  IndianRupee,
  Mail,
  Map,
  MapPinned,
  Route,
  Satellite,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

/**
 * A module that already exists in the application. These links must point at a
 * real, permission-guarded route; they are never rendered as "Planned".
 */
export interface ImplementedModule {
  title: string
  summary: string
  to: string
  icon: LucideIcon
}

export interface RoadmapModule {
  title: string
  summary: string
  contents: string[]
  icon: LucideIcon
}

/**
 * Implemented capabilities, in the order they appear on My work. Keep this list
 * in sync with `app/router.tsx` and the backend controllers named in each
 * summary. A roadmap entry must never duplicate one of these.
 */
export const IMPLEMENTED_MODULES: ImplementedModule[] = [
  {
    title: 'Proposals and approval',
    summary: 'Draft, scrutinise, clarify, recommend and decide consultant proposals.',
    to: '/proposals',
    icon: FileText,
  },
  {
    title: 'Government projects',
    summary: 'Projects created automatically when a proposal is approved.',
    to: '/projects',
    icon: FolderKanban,
  },
  {
    title: 'Acquisition lifecycle',
    summary: 'Cases, surveys, notices, objections, awards and possession.',
    to: '/acquisition',
    icon: MapPinned,
  },
  {
    title: 'Valuation and compensation',
    summary: 'Rate cards, rule sets, estimates, simulated payments and R&R.',
    to: '/monitoring/compensation',
    icon: IndianRupee,
  },
  {
    title: 'GIS and land records',
    summary: 'Parcels, landowners, PostGIS boundaries, alignments and conflicts.',
    to: '/gis',
    icon: Map,
  },
  {
    title: 'Document register',
    summary: 'Validated uploads, versions, maker-checker verification and audited downloads.',
    to: '/land/documents',
    icon: Files,
  },
  {
    title: 'Monitoring and MIS',
    summary: 'Portfolio, district, NLAMS progress, MIS reports and SLA monitoring.',
    to: '/monitoring',
    icon: BarChart3,
  },
  {
    title: 'Notifications and alerts',
    summary: 'In-app workflow notifications, unread badge and SLA escalation log.',
    to: '/notifications',
    icon: Bell,
  },
]

/**
 * Capabilities that are genuinely not implemented yet. External government
 * integrations are listed separately from the internal land-record module,
 * which is already live.
 */
export const ROADMAP_MODULES: Record<string, RoadmapModule> = {
  'routing-rules': {
    title: 'Routing-rule administration',
    summary: 'Configure the automatic scrutiny and decision routing rules from the UI.',
    icon: Route,
    contents: [
      'Create and edit routing rules',
      'Threshold and project-type conditions',
      'Named approver and escalation targets',
      'Audited activation and retirement of rules',
    ],
  },
  'email-sms': {
    title: 'E-mail and SMS delivery',
    summary: 'Deliver workflow notifications outside the application.',
    icon: Mail,
    contents: [
      'E-mail provider configuration',
      'SMS provider configuration',
      'Per-user notification preferences',
      'Delivery tracking and administrator review',
    ],
  },
  'pfms-dbt': {
    title: 'PFMS and DBT payments',
    summary: 'Connect compensation disbursement to the government payment rails.',
    icon: CreditCard,
    contents: [
      'PFMS/DBT payment adapter',
      'Beneficiary and bank validation',
      'Settlement and reconciliation feed',
      'Failed-payment retry and reversal',
    ],
  },
  'isro-bhuvan': {
    title: 'ISRO Bhuvan imagery',
    summary: 'Satellite and thematic map services for the GIS workspace.',
    icon: Satellite,
    contents: [
      'Bhuvan WMS/WMTS configuration',
      'Licensed imagery and attribution',
      'Offline tile fallback',
      'Imagery date and resolution metadata',
    ],
  },
  bhunaksha: {
    title: 'BhuNaksha integration',
    summary: 'Import authoritative cadastral maps and parcel boundaries.',
    icon: Building2,
    contents: [
      'BhuNaksha map service connection',
      'Parcel boundary import and reconciliation',
      'Survey-number matching',
      'Conflict review against entered geometry',
    ],
  },
  'external-land-records': {
    title: 'External 7/12, 8A and Ferfar services',
    summary: 'Exchange revenue records with state land-record systems.',
    icon: FileSearch,
    contents: [
      '7/12 extract service integration',
      '8A record integration',
      'Ferfar mutation feed',
      'Reference, retry and audit handling',
    ],
  },
  'document-security': {
    title: 'Antivirus and document encryption',
    summary: 'Harden uploaded documents beyond type and size validation.',
    icon: ShieldAlert,
    contents: [
      'Antivirus scanning before storage',
      'Encryption at rest and key rotation',
      'Retention and legal-hold policy',
      'Download watermarking and chain of custody',
    ],
  },
}

export const ROADMAP_MODULE_KEYS = Object.keys(ROADMAP_MODULES)
export const DEFAULT_ROADMAP_KEY = ROADMAP_MODULE_KEYS[0]
