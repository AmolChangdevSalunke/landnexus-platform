export type Project = { id: string; name: string; code: string; type: string; district: string; villages: number; land: string; progress: number; status: 'In Progress' | 'Under Review' | 'Completed' | 'On Hold' }
export const projects: Project[] = [
  { id: 'LN-PWD-2026-001', name: 'State Highway Expansion', code: 'SH-60-2026', type: 'Road', district: 'Chhatrapati Sambhajinagar', villages: 12, land: '148.60 ha', progress: 68, status: 'In Progress' },
  { id: 'LN-WRD-2026-004', name: 'Upper Godavari Irrigation Link', code: 'WRD-UG-04', type: 'Dam', district: 'Nashik', villages: 8, land: '92.40 ha', progress: 42, status: 'Under Review' },
  { id: 'LN-EDU-2026-008', name: 'Regional Education Campus', code: 'EDU-08', type: 'School', district: 'Pune', villages: 1, land: '6.20 ha', progress: 91, status: 'In Progress' },
  { id: 'LN-PWD-2025-019', name: 'Rural Connectivity Package', code: 'PWD-RC-19', type: 'Road', district: 'Jalna', villages: 16, land: '74.10 ha', progress: 100, status: 'Completed' },
  { id: 'LN-HLT-2026-011', name: 'District Hospital Extension', code: 'HLT-11', type: 'Hospital', district: 'Kolhapur', villages: 1, land: '3.80 ha', progress: 24, status: 'On Hold' },
]
export const proposals = [
  { id: 'PROP-2026-0142', project: 'State Highway Expansion', consultant: 'Aarambh Infra Consultants', district: 'Chhatrapati Sambhajinagar', submitted: '28 Oct 2026', status: 'Under Scrutiny' },
  { id: 'PROP-2026-0138', project: 'Upper Godavari Irrigation Link', consultant: 'Deccan DPR Associates', district: 'Nashik', submitted: '26 Oct 2026', status: 'Clarification Required' },
  { id: 'PROP-2026-0131', project: 'Regional Education Campus', consultant: 'Civic Design Partners', district: 'Pune', submitted: '21 Oct 2026', status: 'Recommended' },
  { id: 'PROP-2026-0125', project: 'Rural Connectivity Package', consultant: 'MahaPath Engineers', district: 'Jalna', submitted: '15 Oct 2026', status: 'Approved' },
]
export const parcels = [
  { gat: '124/2A', village: 'Khadgaon', taluka: 'Kannad', district: 'Chhatrapati Sambhajinagar', owner: 'Sample Owner A', recorded: '1.820 ha', required: '0.420 ha', status: 'Verified' },
  { gat: '87/1', village: 'Pishor', taluka: 'Kannad', district: 'Chhatrapati Sambhajinagar', owner: 'Sample Owner B', recorded: '2.100 ha', required: '0.315 ha', status: 'Pending' },
  { gat: '219/3', village: 'Nandgaon', taluka: 'Sillod', district: 'Chhatrapati Sambhajinagar', owner: 'Sample Owner C', recorded: '0.960 ha', required: '0.180 ha', status: 'Verified' },
  { gat: '56/4B', village: 'Wadner', taluka: 'Kannad', district: 'Chhatrapati Sambhajinagar', owner: 'Sample Owner D', recorded: '1.440 ha', required: '0.620 ha', status: 'In Review' },
]
export const workflow = [
  { title: 'Proposal submitted', detail: 'Consultant submitted road acquisition proposal', date: '28 Oct 2026 · 10:42 AM', state: 'done' },
  { title: 'Document screening', detail: 'Required documents received; scrutiny initiated', date: '29 Oct 2026 · 02:15 PM', state: 'done' },
  { title: 'Technical scrutiny', detail: 'Reviewing village and Gat-wise land schedule', date: 'In progress', state: 'active' },
  { title: 'Recommendation', detail: 'Scrutiny officer recommendation', date: 'Awaiting', state: 'upcoming' },
  { title: 'Competent authority decision', detail: 'Decision by authorized government authority', date: 'Awaiting', state: 'upcoming' },
]
