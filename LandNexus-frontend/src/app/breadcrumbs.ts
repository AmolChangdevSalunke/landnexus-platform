import type { BreadcrumbItem } from '../components/ui/Breadcrumbs'

const MASTER_RESOURCE_LABELS: Record<string, string> = {
  ministries: 'Ministries',
  departments: 'Departments',
  states: 'States',
  divisions: 'Divisions',
  districts: 'Districts',
  talukas: 'Talukas',
  villages: 'Villages',
}

const ROADMAP_LABELS: Record<string, string> = {
  'land-records': 'Land records',
  documents: 'Documents',
  acquisition: 'Land acquisition',
  'field-surveys': 'Field surveys',
  'valuation-compensation': 'Valuation and compensation',
  gis: 'GIS map',
  'monitoring-mis': 'Monitoring and MIS',
}

function titleCaseSlug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  if (pathname === '/') {
    return [{ label: 'My work' }]
  }

  if (pathname === '/proposals') {
    return [{ label: 'Proposals' }]
  }

  if (pathname === '/proposals/new') {
    return [{ label: 'Proposals', to: '/proposals' }, { label: 'New proposal' }]
  }

  if (pathname.startsWith('/proposals/')) {
    const rest = pathname.slice('/proposals/'.length)
    if (rest.endsWith('/edit')) {
      const proposalId = rest.slice(0, -'/edit'.length)
      return [
        { label: 'Proposals', to: '/proposals' },
        { label: 'Proposal details', to: `/proposals/${proposalId}` },
        { label: 'Edit proposal' },
      ]
    }
    return [{ label: 'Proposals', to: '/proposals' }, { label: 'Proposal details' }]
  }

  if (pathname === '/projects') {
    return [{ label: 'Projects' }]
  }

  if (pathname.startsWith('/projects/')) {
    return [{ label: 'Projects', to: '/projects' }, { label: 'Project details' }]
  }

  if (pathname === '/notifications') {
    return [{ label: 'Notifications' }]
  }

  if (pathname === '/gis') {
    return [{ label: 'GIS map' }]
  }

  if (pathname.startsWith('/admin/master/')) {
    const resource = pathname.split('/')[3] ?? ''
    return [
      { label: 'Administration' },
      { label: 'Master data', to: '/admin/master/ministries' },
      { label: MASTER_RESOURCE_LABELS[resource] ?? titleCaseSlug(resource) },
    ]
  }

  const adminLabels: Record<string, string> = {
    '/admin/users': 'Users',
    '/admin/roles': 'Roles and permissions',
    '/admin/audit': 'Audit trail',
    '/admin/logins': 'Login history',
  }

  if (adminLabels[pathname]) {
    return [{ label: 'Administration' }, { label: adminLabels[pathname] }]
  }

  if (pathname.startsWith('/roadmap/')) {
    const module = pathname.split('/')[2] ?? ''
    return [
      { label: 'Roadmap' },
      { label: ROADMAP_LABELS[module] ?? titleCaseSlug(module) },
    ]
  }

  return [{ label: 'My work', to: '/' }, { label: 'Page' }]
}
