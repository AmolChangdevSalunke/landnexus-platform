import {
  BarChart3,
  ClipboardCheck,
  FileText,
  IndianRupee,
  Map,
  MapPinned,
  Ruler,
  type LucideIcon,
} from 'lucide-react'

export interface RoadmapModule {
  title: string
  summary: string
  contents: string[]
  icon: LucideIcon
}

/**
 * Modules that are deliberately not implemented yet. Keeping them in one place
 * means the dashboard and the roadmap page never drift apart.
 */
export const ROADMAP_MODULES: Record<string, RoadmapModule> = {
  'land-records': {
    title: 'Land records',
    summary: 'Village-wise parcel references and ownership records.',
    icon: MapPinned,
    contents: [
      'Parcel and survey number register',
      'Owner and mutation history',
      'Village and taluka land summaries',
      'Verification status for official records',
    ],
  },
  documents: {
    title: 'Documents',
    summary: 'Secure document storage for proposals and acquisition cases.',
    icon: FileText,
    contents: [
      'Upload and versioning of supporting documents',
      'Document checklists per workflow stage',
      'Access-controlled downloads',
      'Verification and rejection notes',
    ],
  },
  acquisition: {
    title: 'Land acquisition',
    summary: 'Statutory notices, hearings, objections, awards and possession.',
    icon: ClipboardCheck,
    contents: [
      'Acquisition case register',
      'Notice and hearing milestones',
      'Objection and claim tracking',
      'Award and possession records',
    ],
  },
  'field-surveys': {
    title: 'Field surveys',
    summary: 'Field verification and measurement work assigned to officers.',
    icon: Ruler,
    contents: [
      'Survey assignments by district',
      'Measurement and verification records',
      'Field notes and evidence references',
      'Completion and review status',
    ],
  },
  'valuation-compensation': {
    title: 'Valuation and compensation',
    summary: 'Valuation basis, compensation awards and payment progress.',
    icon: IndianRupee,
    contents: [
      'Valuation assessments',
      'Compensation award records',
      'Payment and disbursement tracking',
      'Finance officer review notes',
    ],
  },
  gis: {
    title: 'GIS map',
    summary: 'Map layers, project alignments and affected villages.',
    icon: Map,
    contents: [
      'Project alignment layers',
      'Affected village boundaries',
      'Parcel and land-use layers',
      'Map-based selection and links to records',
    ],
  },
  'monitoring-mis': {
    title: 'Monitoring and MIS',
    summary: 'Management information, SLA tracking and reports.',
    icon: BarChart3,
    contents: [
      'Portfolio monitoring',
      'SLA and overdue action tracking',
      'District and department reports',
      'Exportable management information',
    ],
  },
}

export const ROADMAP_MODULE_KEYS = Object.keys(ROADMAP_MODULES)
