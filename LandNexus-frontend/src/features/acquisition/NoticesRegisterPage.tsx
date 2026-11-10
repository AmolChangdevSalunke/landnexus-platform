import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Printer, RotateCcw, ScrollText } from 'lucide-react'
import { getCase, getCases, getNotices, getObjections } from '../../api/acquisition'
import { getProjects } from '../../api/projects'
import type {
  CaseResponse,
  CaseStatus,
  PageResponse,
  ProjectResponse,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery, type UseApiQueryResult } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, formatDateTime, shortId } from '../../utils/format'
import { PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { CaseStatusBadge } from './CaseStatusBadge'
import {
  CASE_STATUS_LABELS,
  FRAMEWORK_SHORT_LABELS,
  NOTICE_TYPE_LABELS,
  NOTICE_TYPE_VARIANTS,
  OBJECTION_STATUS_LABELS,
  OBJECTION_STATUS_VARIANTS,
} from './labels'

const FILTER_ALL = ''
const STATUS_OPTIONS = Object.entries(CASE_STATUS_LABELS) as [CaseStatus, string][]

/**
 * Standalone register of the legal record. The backend lists notices and
 * objections per case, so the register starts with a case search. The selected
 * case is kept in the URL so a register view can be shared.
 */
export function NoticesRegisterPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('caseId') ?? ''

  const selectedQuery = useApiQuery<CaseResponse | null>(
    () => (selectedId ? getCase(selectedId) : Promise.resolve(null)),
    [selectedId],
    Boolean(selectedId),
  )

  function openCase(caseId: string) {
    setParams({ caseId })
  }

  function clearCase() {
    setParams({})
  }

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Land acquisition"
        title="Notices register"
        description="Every published notice and every objection of a case in one place. Recording and workflow actions stay on the case details page."
        actions={
          selectedId ? (
            <Button variant="outline" onClick={clearCase}>
              Change case
            </Button>
          ) : undefined
        }
      />

      {selectedId ? (
        <SelectedCase query={selectedQuery} onClear={clearCase} />
      ) : (
        <CaseFinder onOpen={openCase} />
      )}
    </>
  )
}

function SelectedCase({
  query,
  onClear,
}: {
  query: UseApiQueryResult<CaseResponse | null>
  onClear: () => void
}) {
  const refs = useReferenceNames()

  if (query.isLoading) {
    return (
      <Card className="space-y-3 p-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    )
  }

  if (query.error) {
    return (
      <Card>
        <ErrorState
          title={
            query.error.status === 404
              ? 'Case not found'
              : query.error.status === 403
                ? 'You do not have access to this case'
                : 'Could not load the case'
          }
          message={query.error.message}
          onRetry={query.reload}
        />
        <div className="flex justify-center pb-6">
          <Button variant="outline" onClick={onClear}>
            Choose another case
          </Button>
        </div>
      </Card>
    )
  }

  const acquisitionCase = query.data
  if (!acquisitionCase) {
    return null
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Selected case
          </p>
          <p className="mt-1 font-mono text-base font-semibold text-navy-900">
            {acquisitionCase.caseNumber}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {refs.districtName(acquisitionCase.districtId) ??
              `District ${shortId(acquisitionCase.districtId)}`}
            {' · '}
            {FRAMEWORK_SHORT_LABELS[acquisitionCase.framework]}
            {' · '}
            {acquisitionCase.villageIds.length}{' '}
            {acquisitionCase.villageIds.length === 1 ? 'village' : 'villages'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CaseStatusBadge status={acquisitionCase.status} />
          <LinkButton to={`/acquisition/${acquisitionCase.id}`} variant="outline" size="sm">
            Open case details
          </LinkButton>
        </div>
      </Card>

      <NoticesSection acquisitionCase={acquisitionCase} />
      <ObjectionsSection acquisitionCase={acquisitionCase} />
    </div>
  )
}

function NoticesSection({ acquisitionCase }: { acquisitionCase: CaseResponse }) {
  const query = useApiQuery(
    () => getNotices(acquisitionCase.id),
    [acquisitionCase.id],
  )

  const notices = (query.data ?? [])
    .slice()
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))

  return (
    <Card className="p-4">
      <CardHeader
        title={`Legal notices (${notices.length})`}
        description="Each notice can be opened as a printable letter. Recording a notice is done on the case details page."
      />

      {query.error ? (
        <div className="mt-4">
          <ErrorState
            title="Could not load notices"
            message={query.error.message}
            onRetry={query.reload}
          />
        </div>
      ) : query.isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notices.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<ScrollText aria-hidden="true" className="h-6 w-6" />}
            title="No notices recorded"
            description="Notices appear here after an authorised officer records them on the case."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {notices.map((notice) => (
            <li
              key={notice.id}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={NOTICE_TYPE_VARIANTS[notice.noticeType]}>
                      {NOTICE_TYPE_LABELS[notice.noticeType]}
                    </Badge>
                    <span className="font-semibold text-navy-900">
                      {notice.referenceNumber}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Issued {formatDate(notice.issuedOn)}
                    {notice.objectionDeadline
                      ? ` · objection deadline ${formatDate(notice.objectionDeadline)}`
                      : ''}
                    {notice.createdBy ? ` · recorded by ${notice.createdBy}` : ''}
                  </p>
                  {notice.description ? (
                    <p className="mt-2 text-sm text-slate-700">{notice.description}</p>
                  ) : null}
                </div>
                <LinkButton
                  to={`/acquisition/notices/${acquisitionCase.id}/${notice.id}`}
                  variant="ghost"
                  size="sm"
                  leftIcon={<Printer aria-hidden="true" className="h-3.5 w-3.5" />}
                >
                  Print letter
                </LinkButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ObjectionsSection({ acquisitionCase }: { acquisitionCase: CaseResponse }) {
  const query = useApiQuery(
    () => getObjections(acquisitionCase.id),
    [acquisitionCase.id],
  )

  const objections = query.data ?? []

  return (
    <Card className="p-4">
      <CardHeader
        title={`Objections (${objections.length})`}
        description="Registering and deciding objections happens on the case details page while the objection window is open."
      />

      {query.error ? (
        <div className="mt-4">
          <ErrorState
            title="Could not load objections"
            message={query.error.message}
            onRetry={query.reload}
          />
        </div>
      ) : query.isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : objections.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No objections registered"
            description="Objections appear here once they are registered during the published objection period."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {objections.map((objection) => (
            <li
              key={objection.id}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-navy-900">
                  {objection.objectionNumber}
                </span>
                <Badge variant={OBJECTION_STATUS_VARIANTS[objection.status]}>
                  {OBJECTION_STATUS_LABELS[objection.status]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Received {formatDate(objection.receivedOn)} · affected parcel{' '}
                <span className="font-mono" title={objection.caseParcelId}>
                  {shortId(objection.caseParcelId)}
                </span>
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {objection.grounds}
              </p>
              {objection.decidedAt ? (
                <p className="mt-2 text-xs text-slate-500">
                  Decided {formatDateTime(objection.decidedAt)}
                  {objection.decisionRemarks ? ` · ${objection.decisionRemarks}` : ''}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function CaseFinder({
  onOpen,
}: {
  onOpen: (caseId: string) => void
}) {
  const { canAny } = useAuth()
  const refs = useReferenceNames()
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)

  const [status, setStatus] = useState<CaseStatus | typeof FILTER_ALL>(FILTER_ALL)
  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [projectId, setProjectId] = useState(FILTER_ALL)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const query = useApiQuery(
    () =>
      getCases({
        status: status || undefined,
        districtId: districtId || undefined,
        projectId: projectId || undefined,
        page,
        size,
      }),
    [status, districtId, projectId, page, size],
  )

  const projectsQuery = useApiQuery<PageResponse<ProjectResponse> | null>(
    () => (canReadProjects ? getProjects({ size: 100 }) : Promise.resolve(null)),
    [canReadProjects],
  )

  const projects = (projectsQuery.data?.content ?? []).filter(
    (project) => project.status === 'ACTIVE' || project.id === projectId,
  )
  const projectById = new Map(projects.map((project) => [project.id, project]))

  const hasFilters = status !== FILTER_ALL || districtId !== FILTER_ALL || projectId !== FILTER_ALL
  const rows = query.data?.content ?? []

  function changeStatus(next: string) {
    setStatus(next as CaseStatus | typeof FILTER_ALL)
    setPage(0)
  }

  function changeDistrict(next: string) {
    setDistrictId(next)
    setPage(0)
  }

  function changeProject(next: string) {
    setProjectId(next)
    setPage(0)
  }

  function clearFilters() {
    setStatus(FILTER_ALL)
    setDistrictId(FILTER_ALL)
    setProjectId(FILTER_ALL)
    setPage(0)
  }

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  const districtOptions = refs.districts.filter(
    (district) => district.status === 'ACTIVE' || district.id === districtId,
  )
  const districtFilterDisabled = !refs.enabled || refs.isLoading || refs.error !== null

  const columns: TableColumn<(typeof rows)[number]>[] = [
    {
      key: 'case',
      header: 'Case',
      render: (acquisitionCase) => {
        const project = projectById.get(acquisitionCase.projectId)
        return (
          <div className="min-w-56">
            <p className="font-mono font-semibold text-navy-900">
              {acquisitionCase.caseNumber}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {project ? project.title : `Project ${shortId(acquisitionCase.projectId)}`}
            </p>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (acquisitionCase) => <CaseStatusBadge status={acquisitionCase.status} />,
    },
    {
      key: 'district',
      header: 'District',
      render: (acquisitionCase) => (
        <span title={acquisitionCase.districtId}>
          {refs.districtName(acquisitionCase.districtId) ?? shortId(acquisitionCase.districtId)}
        </span>
      ),
    },
    {
      key: 'villages',
      header: 'Villages',
      render: (acquisitionCase) => (
        <span className="whitespace-nowrap text-slate-700">
          {acquisitionCase.villageIds.length}{' '}
          {acquisitionCase.villageIds.length === 1 ? 'village' : 'villages'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (acquisitionCase) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpen(acquisitionCase.id)}
        >
          Open register
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader
          title="Find a case"
          description="Only cases inside your role and geographic scope are listed. The backend decides what is visible."
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={clearFilters}
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              >
                Clear filters
              </Button>
            ) : null
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Select
            label="Status"
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
          >
            <option value={FILTER_ALL}>All statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            label="District"
            value={districtId}
            onChange={(event) => changeDistrict(event.target.value)}
            disabled={districtFilterDisabled}
            hint={
              districtFilterDisabled
                ? 'District names are not available right now.'
                : 'Only districts in your scope are listed.'
            }
          >
            <option value={FILTER_ALL}>All districts</option>
            {districtOptions.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </Select>

          <Select
            label="Project"
            value={projectId}
            onChange={(event) => changeProject(event.target.value)}
            disabled={!canReadProjects || projectsQuery.isLoading}
            hint={
              canReadProjects
                ? 'Approved projects visible to you.'
                : 'Project data needs proposal read access.'
            }
          >
            <option value={FILTER_ALL}>All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.title}
              </option>
            ))}
          </Select>

          <div className="flex justify-end">
            <Button variant="outline" onClick={query.reload} disabled={query.isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {projectsQuery.error ? (
          <p role="alert" className="mt-3 text-xs font-medium text-warning-700">
            Project names could not be loaded. ({projectsQuery.error.message})
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={query.error.status === 403 ? 'You do not have access' : 'Could not load cases'}
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(acquisitionCase) => acquisitionCase.id}
          isLoading={query.isLoading}
          caption="Acquisition cases available for the notices register"
          emptyTitle={hasFilters ? 'No cases match these filters' : 'No acquisition cases yet'}
          emptyDescription={
            hasFilters
              ? 'Try another status, district or project, or clear the filters.'
              : 'Cases appear here when they are started for your district.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
          page={query.data?.page ?? page}
          size={query.data?.size ?? size}
          totalElements={query.data?.totalElements ?? 0}
          totalPages={query.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={changeSize}
        />
      )}

      {query.data ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            to="/acquisition"
            className="font-medium text-blue-700 hover:underline"
          >
            Acquisition cases
          </Link>
          <span>
            · {query.data.totalElements}{' '}
            {query.data.totalElements === 1 ? 'case' : 'cases'}
            {hasFilters ? ' match your filters' : ' available'}.
          </span>
        </p>
      ) : null}
    </div>
  )
}
