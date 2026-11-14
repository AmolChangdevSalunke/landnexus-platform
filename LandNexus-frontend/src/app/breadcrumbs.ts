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
  'routing-rules': 'Routing-rule administration',
  'notification-settings': 'Notification preferences and delivery console',
  'pfms-dbt': 'PFMS and DBT payments',
  'isro-bhuvan': 'ISRO Bhuvan imagery',
  bhunaksha: 'BhuNaksha integration',
  'external-land-records': 'External 7/12, 8A and Ferfar services',
  'document-security': 'Antivirus and document encryption',
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

  if (pathname === '/land/parcels') {
    return [{ label: 'Land parcels' }]
  }

  if (pathname === '/land/parcels/new') {
    return [{ label: 'Land parcels', to: '/land/parcels' }, { label: 'New parcel' }]
  }

  if (pathname.startsWith('/land/parcels/')) {
    const rest = pathname.slice('/land/parcels/'.length)
    if (rest.endsWith('/edit')) {
      const parcelId = rest.slice(0, -'/edit'.length)
      return [
        { label: 'Land parcels', to: '/land/parcels' },
        { label: 'Parcel details', to: `/land/parcels/${parcelId}` },
        { label: 'Edit parcel' },
      ]
    }
    return [{ label: 'Land parcels', to: '/land/parcels' }, { label: 'Parcel details' }]
  }

  if (pathname === '/land/landowners') {
    return [{ label: 'Landowners' }]
  }

  if (pathname === '/acquisition') {
    return [{ label: 'Acquisition cases' }]
  }

  if (pathname === '/acquisition/new') {
    return [
      { label: 'Acquisition cases', to: '/acquisition' },
      { label: 'New case' },
    ]
  }

  if (pathname === '/acquisition/my-surveys') {
    return [
      { label: 'Acquisition cases', to: '/acquisition' },
      { label: 'My surveys' },
    ]
  }

  if (pathname.startsWith('/acquisition/')) {
    const parts = pathname.split('/').filter(Boolean)
    // /acquisition/:id/surveys/:caseParcelId/new
    if (parts.length === 6 && parts[2] === 'surveys' && parts[5] === 'new') {
      return [
        { label: 'Acquisition cases', to: '/acquisition' },
        { label: 'Case details', to: `/acquisition/${parts[1]}` },
        { label: 'New survey' },
      ]
    }
    return [
      { label: 'Acquisition cases', to: '/acquisition' },
      { label: 'Case details' },
    ]
  }

  if (pathname === '/monitoring' || pathname.startsWith('/monitoring/')) {
    const monitoringLabels: Record<string, string> = {
      '/monitoring': 'Dashboard',
      '/monitoring/projects': 'Projects',
      '/monitoring/nlams': 'NLAMS progress',
      '/monitoring/geography': 'Districts and states',
      '/monitoring/lifecycle': 'Acquisition lifecycle',
      '/monitoring/compensation': 'Compensation',
      '/monitoring/reports': 'MIS reports',
      '/monitoring/sla': 'SLA and alerts',
    }
    const label = monitoringLabels[pathname] ?? titleCaseSlug(pathname.split('/')[2] ?? '')
    return pathname === '/monitoring'
      ? [{ label: 'Monitoring and MIS' }, { label }]
      : [{ label: 'Monitoring and MIS', to: '/monitoring' }, { label }]
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
