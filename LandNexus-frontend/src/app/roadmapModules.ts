import {
  BarChart3,
  IndianRupee,
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
