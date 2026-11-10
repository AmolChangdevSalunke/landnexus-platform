import { useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { getCase } from '../../api/acquisition'
import { getValuation } from '../../api/compensation'
import type { CaseResponse, ValuationResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import {
  formatArea,
  formatDate,
  formatDateTime,
  formatMoney,
  shortId,
} from '../../utils/format'
import { LAND_CLASSIFICATION_LABELS } from '../landRecords/labels'
import { VALUATION_STATUS_LABELS, VALUATION_STATUS_VARIANTS } from './labels'

/**
 * Standalone record of one compensation estimate, wired to the by-id endpoint.
 * Every amount shown is what the backend returned; the browser never adds money
 * up. Printing happens in the browser, so no new endpoint is involved.
 */
export function ValuationDetailPage() {
  const { id } = useParams<{ id: string }>()

  const valuationQuery = useApiQuery<ValuationResponse | null>(
    () => (id ? getValuation(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  const valuation = valuationQuery.data

  const caseQuery = useApiQuery<CaseResponse | null>(
    () => (valuation ? getCase(valuation.caseId) : Promise.resolve(null)),
    [valuation?.caseId],
    Boolean(valuation?.caseId),
  )

  if (valuationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (valuationQuery.error || !valuation) {
    return (
      <>
        <PageHeader
          eyebrow="Module 5 · Compensation"
          title="Compensation estimate record"
          description="The estimate could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              valuationQuery.error?.status === 404
                ? 'Estimate not found'
                : valuationQuery.error?.status === 403
                  ? 'You do not have access to this estimate'
                  : 'Could not load the estimate'
            }
            message={
              valuationQuery.error?.message ??
              'It may not exist, or you may not have access.'
            }
            onRetry={valuationQuery.reload}
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
      <div className="print:hidden">
        <PageHeader
          eyebrow="Module 5 · Compensation"
          title="Compensation estimate record"
          description="The full record of one estimate. Amounts come only from the approved rate card and rule set; the total is calculated by the backend."
          actions={
            <>
              <LinkButton
                to={`/acquisition/${valuation.caseId}`}
                variant="outline"
                leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
              >
                Back to case
              </LinkButton>
              <Button
                onClick={() => window.print()}
                leftIcon={<Printer aria-hidden="true" className="h-4 w-4" />}
              >
                Print estimate
              </Button>
            </>
          }
        />
      </div>

      <Card className="mx-auto max-w-4xl p-8 print:border-0 print:shadow-none">
        <article className="record text-slate-900">
          <header className="border-b-2 border-navy-900 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                LandNexus · Compensation estimate
              </p>
              <Badge variant={VALUATION_STATUS_VARIANTS[valuation.status]}>
                {VALUATION_STATUS_LABELS[valuation.status]}
              </Badge>
            </div>
            <h1 className="mt-2 text-xl font-bold text-navy-900">
              Estimate version {valuation.versionNo}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Acquisition case{' '}
              {acquisitionCase ? acquisitionCase.caseNumber : shortId(valuation.caseId)} ·
              reference date {formatDate(valuation.referenceDate)}
            </p>
          </header>

          <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="font-semibold">Parcel:</span>{' '}
              <span className="font-mono" title={valuation.parcelId}>
                {valuation.parcelId}
              </span>
              <CopyButton value={valuation.parcelId} label="parcel id" />
            </p>
            <p>
              <span className="font-semibold">Awarded area:</span>{' '}
              {formatArea(valuation.awardedAreaHa)}
            </p>
            <p>
              <span className="font-semibold">Classification:</span>{' '}
              {LAND_CLASSIFICATION_LABELS[valuation.classification]}
            </p>
            <p>
              <span className="font-semibold">Rate applied:</span>{' '}
              {formatMoney(valuation.ratePerHa)} per hectare
            </p>
            <p>
              <span className="font-semibold">Rule set:</span>{' '}
              {valuation.ruleSetName} v{valuation.ruleSetVersion}
            </p>
            <p>
              <span className="font-semibold">Prepared by:</span>{' '}
              {valuation.preparedByUsername}
            </p>
          </div>

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-700">
            How the amount was built
          </h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <caption className="sr-only">
              Line-by-line compensation breakdown for estimate version{' '}
              {valuation.versionNo}
            </caption>
            <thead>
              <tr className="border-b border-slate-400 text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Component
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  How it was calculated
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {valuation.lines.map((line) => (
                <tr key={`${line.position}-${line.code}`} className="border-b border-slate-200">
                  <td className="py-2 pr-4">
                    <p className="font-medium">{line.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{line.code}</p>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{line.basis}</td>
                  <td className="whitespace-nowrap py-2 text-right font-medium tabular-nums">
                    {formatMoney(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-400">
                <th scope="row" colSpan={2} className="py-2 pr-4 text-right font-semibold">
                  Asset total included
                </th>
                <td className="whitespace-nowrap py-2 text-right tabular-nums text-slate-600">
                  {formatMoney(valuation.assetTotal)}
                </td>
              </tr>
              <tr>
                <th scope="row" colSpan={2} className="py-2 pr-4 text-right text-base font-bold text-navy-900">
                  Total (calculated by the server)
                </th>
                <td className="whitespace-nowrap py-2 text-right text-base font-bold tabular-nums text-navy-900">
                  {formatMoney(valuation.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {valuation.decisionRemarks ? (
            <p className="mt-6 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-7">
              <span className="font-semibold">Decision remarks:</span>{' '}
              {valuation.decisionRemarks}
              {valuation.decidedAt ? ` · ${formatDateTime(valuation.decidedAt)}` : ''}
            </p>
          ) : null}

          <footer className="mt-10 border-t border-slate-300 pt-4 text-xs text-slate-500">
            <p>
              Estimate ID <span className="font-mono">{valuation.id}</span>
              <CopyButton value={valuation.id} label="estimate id" />
              {valuation.decidedByUserId ? (
                <>
                  {' '}· decided by user{' '}
                  <span className="font-mono" title={valuation.decidedByUserId}>
                    {shortId(valuation.decidedByUserId)}
                  </span>
                </>
              ) : null}
            </p>
            <p className="mt-1">
              This record is generated from the LandNexus case record. Every access is
              logged in the audit trail. Payments under this estimate are simulated.
            </p>
          </footer>
        </article>
      </Card>
    </>
  )
}
