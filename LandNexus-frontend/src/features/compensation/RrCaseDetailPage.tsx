import { useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getCase } from '../../api/acquisition'
import { getRrCase } from '../../api/compensation'
import type { CaseResponse, RrCaseResponse, RrEntitlementResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatDate, formatMoney, shortId } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { RR_BENEFIT_KIND_LABELS, RR_CASE_STATUS_LABELS, RR_CASE_STATUS_VARIANTS } from './labels'
import { LandownerName } from './LandownerName'

/**
 * Standalone record of one R&R family, wired to the by-id endpoint. It shows
 * only the two plain facts the benefit conditions use; there is no field for
 * caste, religion or any other sensitive attribute.
 */
export function RrCaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()
  const canReadLandowners = can(PERMISSION.LANDOWNER_READ)

  const rrQuery = useApiQuery<RrCaseResponse | null>(
    () => (id ? getRrCase(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  const rrCase = rrQuery.data

  const caseQuery = useApiQuery<CaseResponse | null>(
    () => (rrCase ? getCase(rrCase.caseId) : Promise.resolve(null)),
    [rrCase?.caseId],
    Boolean(rrCase?.caseId),
  )

  if (rrQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (rrQuery.error || !rrCase) {
    return (
      <>
        <PageHeader
          eyebrow="Module 5 · Rehabilitation and resettlement"
          title="R&R family record"
          description="The family record could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              rrQuery.error?.status === 404
                ? 'Family not found'
                : rrQuery.error?.status === 403
                  ? 'You do not have access to this family record'
                  : 'Could not load the family record'
            }
            message={rrQuery.error?.message ?? 'It may not exist, or you may not have access.'}
            onRetry={rrQuery.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/acquisition" variant="outline">
              Back to cases
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  const acquisitionCase = caseQuery.data

  return (
    <>
      <PageHeader
        eyebrow="Module 5 · Rehabilitation and resettlement"
        title="R&R family record"
        description="The recorded facts and every benefit of one affected family. Benefits come from the catalogue approved by the administering authority."
        actions={
          <LinkButton
            to={`/acquisition/${rrCase.caseId}`}
            variant="outline"
            leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
          >
            Back to case
          </LinkButton>
        }
      />

      <Card className="p-4">
        <CardHeader
          title="Family"
          description={
            acquisitionCase
              ? `Acquisition case ${acquisitionCase.caseNumber}`
              : `Acquisition case ${shortId(rrCase.caseId)}`
          }
          action={
            <Badge variant={RR_CASE_STATUS_VARIANTS[rrCase.status]}>
              {RR_CASE_STATUS_LABELS[rrCase.status]}
            </Badge>
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Beneficiary
            </p>
            <div className="mt-1">
              <LandownerName
                landownerId={rrCase.landownerId}
                canReadLandowners={canReadLandowners}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Facts used by benefit conditions
            </p>
            <p className="mt-1 text-sm font-medium text-navy-900">
              {rrCase.displaced ? 'Lost their home' : 'Home not lost'}
              {' · '}
              {rrCase.livelihoodLost ? 'Lost their livelihood' : 'Livelihood not lost'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Record
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-700">
              <span>Identified by user</span>
              <span className="font-mono" title={rrCase.createdByUserId}>
                {shortId(rrCase.createdByUserId)}
              </span>
              <CopyButton value={rrCase.id} label="family record id" />
            </p>
            {rrCase.decidedAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Decided {formatDate(rrCase.decidedAt)}
              </p>
            ) : null}
          </div>
        </div>

        {rrCase.notes ? (
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {rrCase.notes}
          </p>
        ) : null}

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-navy-900">Benefits</h3>
          <EntitlementsTable entitlements={rrCase.entitlements} />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Benefit recording, approval and delivery happen on the case details page. This
          record shows what the backend returned for this family.
        </p>
      </Card>
    </>
  )
}

function EntitlementsTable({ entitlements }: { entitlements: RrEntitlementResponse[] }) {
  const columns: TableColumn<RrEntitlementResponse>[] = [
    {
      key: 'benefit',
      header: 'Benefit',
      render: (entitlement) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-900">{entitlement.benefitName}</p>
          <p className="font-mono text-[10px] text-slate-500">{entitlement.benefitCode}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (entitlement) => RR_BENEFIT_KIND_LABELS[entitlement.kind],
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (entitlement) =>
        entitlement.amount === null ? '—' : formatMoney(entitlement.amount),
    },
    {
      key: 'months',
      header: 'Months',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (entitlement) => entitlement.months ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (entitlement) => (
        <div className="space-y-1">
          <Badge variant={entitlement.status === 'DELIVERED' ? 'success' : 'neutral'}>
            {entitlement.status === 'DELIVERED' ? 'Delivered' : 'Planned'}
          </Badge>
          {entitlement.deliveredOn ? (
            <p className="text-xs text-slate-500">{formatDate(entitlement.deliveredOn)}</p>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="mt-2">
      <DataTable
        columns={columns}
        rows={entitlements}
        rowKey={(entitlement) => entitlement.id}
        caption="Benefits recorded for this family"
        emptyTitle="No benefit recorded"
        emptyDescription="Benefits appear here after an R&R officer adds them from the catalogue."
      />
    </div>
  )
}
