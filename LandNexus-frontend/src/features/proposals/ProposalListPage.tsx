import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, RotateCcw } from 'lucide-react'
import { getProposals } from '../../api/proposals'
import type { ProposalResponse, ProposalStatus } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import {
  PROPOSAL_STATUS_OPTIONS,
  PROJECT_TYPE_LABELS,
} from './labels'
import { StatusBadge } from './StatusBadge'

const FILTER_ALL = ''

export function ProposalListPage() {
  const { can } = useAuth()
  const refs = useReferenceNames()
  const canCreate = can(PERMISSION.PROPOSAL_CREATE)

  const [status, setStatus] = useState<ProposalStatus | typeof FILTER_ALL>(FILTER_ALL)
  const [districtId, setDistrictId] = useState(FILTER_ALL)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const query = useApiQuery(
    () =>
      getProposals({
        status: status || undefined,
        districtId: districtId || undefined,
        page,
        size,
      }),
    [status, districtId, page, size],
  )

  const hasFilters = status !== FILTER_ALL || districtId !== FILTER_ALL
  const rows = query.data?.content ?? []

  function changeStatus(next: string) {
    setStatus(next as ProposalStatus | typeof FILTER_ALL)
    setPage(0)
  }

  function changeDistrict(next: string) {
    setDistrictId(next)
    setPage(0)
  }

  function clearFilters() {
    setStatus(FILTER_ALL)
    setDistrictId(FILTER_ALL)
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

  const columns: TableColumn<ProposalResponse>[] = [
    {
      key: 'proposal',
      header: 'Proposal',
      render: (proposal) => (
        <div className="min-w-56">
          <Link
            to={`/proposals/${proposal.id}`}
            className="font-semibold text-navy-900 hover:text-blue-700"
          >
            {proposal.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {proposal.proposalNumber ? (
              <span className="font-mono">{proposal.proposalNumber}</span>
            ) : (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                Draft
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{PROJECT_TYPE_LABELS[proposal.projectType]}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (proposal) => <StatusBadge status={proposal.status} />,
    },
    {
      key: 'district',
      header: 'District',
      render: (proposal) => (
        <span title={proposal.districtId}>
          {refs.districtName(proposal.districtId) ?? shortId(proposal.districtId)}
        </span>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (proposal) =>
        proposal.submittedAt ? (
          <span title={proposal.submittedAt}>{formatDate(proposal.submittedAt)}</span>
        ) : (
          <span className="text-slate-500">Not submitted</span>
        ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (proposal) => (
        <span className="whitespace-nowrap" title={proposal.updatedAt}>
          {formatDate(proposal.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (proposal) => (
        <LinkButton to={`/proposals/${proposal.id}`} variant="outline" size="sm">
          View
        </LinkButton>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Module 2 · Consultant proposals"
        title="Proposals"
        description="Proposals you can see, based on your role and geographic scope. The backend decides what is visible."
        actions={
          canCreate ? (
            <LinkButton
              to="/proposals/new"
              leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
            >
              New proposal
            </LinkButton>
          ) : null
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Select
            label="Status"
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
          >
            <option value={FILTER_ALL}>All statuses</option>
            {PROPOSAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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

          <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
            {hasFilters ? (
              <Button
                variant="outline"
                onClick={clearFilters}
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
              >
                Clear filters
              </Button>
            ) : null}
            <Button variant="outline" onClick={query.reload} disabled={query.isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {query.data ? (
          <p className="mt-3 text-xs text-slate-500">
            {query.data.totalElements}{' '}
            {query.data.totalElements === 1 ? 'proposal' : 'proposals'}
            {hasFilters ? ' match your filters' : ' visible to you'}
            {refs.enabled && !refs.isLoading && refs.districts.length === 0
              ? ' · No districts are assigned to your account'
              : null}
          </p>
        ) : null}
      </Card>

      {query.error ? (
        <Card>
          <ErrorState
            title={query.error.status === 403 ? 'You do not have access' : 'Could not load proposals'}
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(proposal) => proposal.id}
          isLoading={query.isLoading}
          caption="Consultant proposals visible to you"
          emptyTitle={hasFilters ? 'No proposals match these filters' : 'No proposals yet'}
          emptyDescription={
            hasFilters
              ? 'Try another status or district, or clear the filters.'
              : canCreate
                ? 'Create a draft proposal for a district in your scope.'
                : 'No proposals are visible to your account yet.'
          }
          emptyAction={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canCreate ? (
              <LinkButton to="/proposals/new">New proposal</LinkButton>
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

      {query.data && query.data.totalElements > 0 ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Badge variant="neutral">Read only list</Badge>
          Decision reasons and actions are on the proposal details page.
        </p>
      ) : null}
    </>
  )
}
