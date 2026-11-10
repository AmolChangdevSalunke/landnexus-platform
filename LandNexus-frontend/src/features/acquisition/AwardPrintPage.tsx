import { useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { getAward, getCase } from '../../api/acquisition'
import { toApiErrorInfo } from '../../api/errors'
import type { AwardResponse, CaseResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatArea, formatDate, shortId } from '../../utils/format'
import { FRAMEWORK_LABELS } from './labels'

/** A declared award is returned as 404 until it exists; that is "not declared yet". */
function loadAward(caseId: string): Promise<AwardResponse | null> {
  return getAward(caseId).catch((caught: unknown) => {
    if (toApiErrorInfo(caught).status === 404) {
      return null
    }
    throw caught
  })
}

/**
 * Printable copy of the declared award. It renders only data the backend
 * returned for the case; printing happens in the browser, so no new endpoint
 * is involved.
 */
export function AwardPrintPage() {
  const { id } = useParams<{ id: string }>()
  const refs = useReferenceNames()

  const caseQuery = useApiQuery<CaseResponse | null>(
    () => (id ? getCase(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  const awardQuery = useApiQuery<AwardResponse | null>(
    () => (id ? loadAward(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  if (caseQuery.isLoading || awardQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (caseQuery.error || !caseQuery.data) {
    return (
      <>
        <PageHeader
          eyebrow="Module 4 · Land acquisition"
          title="Award letter"
          description="The award could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              caseQuery.error?.status === 404
                ? 'Case not found'
                : caseQuery.error?.status === 403
                  ? 'You do not have access'
                  : 'Could not load the case'
            }
            message={caseQuery.error?.message ?? 'It may not exist, or you may not have access.'}
            onRetry={caseQuery.reload}
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

  if (awardQuery.error || !awardQuery.data) {
    return (
      <>
        <PageHeader
          eyebrow="Module 4 · Land acquisition"
          title="Award letter"
          description="There is no award to print for this case."
        />
        <Card>
          <ErrorState
            title={
              awardQuery.error ? 'Could not load the award' : 'No award declared yet'
            }
            message={
              awardQuery.error?.message ??
              'The award letter can be printed after a competent authority declares the award.'
            }
            onRetry={awardQuery.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to={`/acquisition/${acquisitionCase.id}`} variant="outline">
              Back to case details
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  const award = awardQuery.data

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Module 4 · Land acquisition"
          title="Award letter"
          description="A printable copy of the declared award. The printed text is exactly what the backend returned."
          actions={
            <>
              <LinkButton
                to={`/acquisition/${acquisitionCase.id}`}
                variant="outline"
                leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
              >
                Back to case
              </LinkButton>
              <Button
                onClick={() => window.print()}
                leftIcon={<Printer aria-hidden="true" className="h-4 w-4" />}
              >
                Print this award
              </Button>
            </>
          }
        />
      </div>

      <Card className="mx-auto max-w-3xl p-8 print:border-0 print:shadow-none">
        <article className="letter text-slate-900">
          <header className="border-b-2 border-navy-900 pb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              LandNexus · Unified Digital Land Acquisition Platform
            </p>
            <h1 className="mt-2 text-xl font-bold text-navy-900">
              Award {award.awardNumber}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Declared on {formatDate(award.awardDate)}
            </p>
          </header>

          <div className="mt-6 grid gap-2 text-sm">
            <p>
              <span className="font-semibold">Acquisition case:</span>{' '}
              {acquisitionCase.caseNumber}
            </p>
            <p>
              <span className="font-semibold">Legal framework:</span>{' '}
              {FRAMEWORK_LABELS[acquisitionCase.framework]}
            </p>
            <p>
              <span className="font-semibold">District:</span>{' '}
              {refs.districtName(acquisitionCase.districtId) ??
                `District ${shortId(acquisitionCase.districtId)}`}
            </p>
            <p>
              <span className="font-semibold">Declared by user:</span>{' '}
              <span className="font-mono" title={award.declaredByUserId}>
                {shortId(award.declaredByUserId)}
              </span>
              <CopyButton value={award.declaredByUserId} label="declaring user id" />
            </p>
          </div>

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-700">
            Awarded land
          </h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-400 text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Case parcel
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Parcel
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Awarded area
                </th>
              </tr>
            </thead>
            <tbody>
              {award.lines.map((line) => (
                <tr key={line.caseParcelId} className="border-b border-slate-200">
                  <td className="py-2 pr-4">
                    <span className="font-mono" title={line.caseParcelId}>
                      {shortId(line.caseParcelId)}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="font-mono" title={line.parcelId}>
                      {shortId(line.parcelId)}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatArea(line.awardedAreaHa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {award.remarks ? (
            <p className="mt-6 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-7 text-slate-800">
              <span className="font-semibold">Remarks:</span> {award.remarks}
            </p>
          ) : null}

          <p className="mt-4 text-xs leading-6 text-slate-500">
            Compensation and rehabilitation are assessed and paid under the separate
            compensation record for this case. This award letter records the awarded
            land only.
          </p>

          <footer className="mt-10 border-t border-slate-300 pt-4 text-xs text-slate-500">
            <p>
              Case ID <span className="font-mono">{acquisitionCase.id}</span>
              <CopyButton value={acquisitionCase.id} label="case id" />
            </p>
            <p className="mt-1">
              This printout is generated from the LandNexus case record. Every access
              is logged in the audit trail.
            </p>
          </footer>
        </article>
      </Card>
    </>
  )
}
