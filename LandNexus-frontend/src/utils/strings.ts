export const APP_NAME = 'LandNexus'
export const APP_TAGLINE =
  'Unified Digital Land Acquisition & Infrastructure Project Management Platform'
export const APP_FULL_NAME = `${APP_NAME} – ${APP_TAGLINE}`

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrator',
  CENTRAL_ADMIN: 'Central administrator',
  MINISTRY_ADMIN: 'Ministry administrator',
  STATE_ADMIN: 'State administrator',
  DIVISION_ADMIN: 'Division administrator',
  DISTRICT_ADMIN: 'District administrator',
  CONSULTANT: 'Consultant',
  SCRUTINY_OFFICER: 'Scrutiny officer',
  FIELD_OFFICER: 'Field officer',
  COMPETENT_AUTHORITY: 'Competent authority',
  FINANCE_OFFICER: 'Finance officer',
  AUDITOR: 'Auditor',
  CITIZEN: 'Citizen',
}

export function formatRole(code: string): string {
  return ROLE_LABELS[code] ?? code.replaceAll('_', ' ')
}

export function formatRoleList(roles: string[]): string {
  return roles.length > 0 ? roles.map(formatRole).join(', ') : 'No role assigned'
}

export function appName(): string {
  const configured = import.meta.env.VITE_APP_NAME
  return typeof configured === 'string' && configured.trim() ? configured.trim() : APP_NAME
}
