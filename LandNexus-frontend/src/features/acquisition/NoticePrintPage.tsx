import { useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { getCase, getNotices } from '../../api/acquisition'
import type { CaseResponse, NoticeResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, shortId } from '../../utils/format'
import { FRAMEWORK_LABELS, NOTICE_TYPE_LABELS } from './labels'

/**
 * Printable letter for one recorded notice. It renders only data the backend
 * returned for the case; printing happens in the browser, so no new endpoint
 * is involved.
 */
export function NoticePrintPage() {
  const { caseId, noticeId } = useParams<{ caseId: string; noticeId: string }>()
  const refs = useReferenceNames()

  const caseQuery = useApiQuery<CaseResponse | null>(
    () => (caseId ? getCase(caseId) : Promise.resolve(null)),
    [caseId],
    Boolean(caseId),
  )

  const noticesQuery = useApiQuery<NoticeResponse[] | null>(
    () => (caseId ? getNotices(caseId) : Promise.resolve(null)),
    [caseId],
    Boolean(caseId),
  )

  if (caseQuery.isLoading || noticesQuery.isLoading) {
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
          title="Notice letter"
          description="The notice could not be loaded."
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
            <LinkButton to="/acquisition/notices" variant="outline">
              Back to notices register
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  const acquisitionCase = caseQuery.data
  const notice =
    noticesQuery.data?.find((entry) => entry.id === noticeId) ?? null

  if (noticesQuery.error || !notice) {
    return (
      <>
        <PageHeader
          eyebrow="Module 4 · Land acquisition"
          title="Notice letter"
          description="The notice could not be loaded."
        />
        <Card>
          <ErrorState
            title="Notice not found"
            message={
              noticesQuery.error?.message ??
              'This notice is not part of the case record.'
            }
            onRetry={noticesQuery.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton
              to={`/acquisition/notices?caseId=${acquisitionCase.id}`}
              variant="outline"
            >
              Back to this case's register
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  const villageNames = acquisitionCase.villageIds
    .map((villageId) => refs.villageName(villageId) ?? `Village ${shortId(villageId)}`)
    .join(', ')

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Module 4 · Land acquisition"
          title="Notice letter"
          description="A printable copy of the recorded notice. The printed text is exactly what the backend returned."
          actions={
            <>
              <LinkButton
                to={`/acquisition/notices?caseId=${acquisitionCase.id}`}
                variant="outline"
                leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
              >
                Back to register
              </LinkButton>
              <Button
                onClick={() => window.print()}
                leftIcon={<Printer aria-hidden="true" className="h-4 w-4" />}
              >
                Print this notice
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
              {NOTICE_TYPE_LABELS[notice.noticeType]}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Reference {notice.referenceNumber} · Issued on {formatDate(notice.issuedOn)}
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
              <span className="font-semibold">Villages affected:</span> {villageNames}
            </p>
            {notice.objectionDeadline ? (
              <p>
                <span className="font-semibold">Objection period ends on:</span>{' '}
                {formatDate(notice.objectionDeadline)}
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            <p className="text-sm leading-7 text-slate-800">
              {notice.description ??
                `This notice is recorded against acquisition case ${acquisitionCase.caseNumber}. It is published as per the legal framework shown above.`}
            </p>
            {notice.objectionDeadline ? (
              <p className="mt-4 text-sm leading-7 text-slate-800">
                Objections to this acquisition may be registered until{' '}
                {formatDate(notice.objectionDeadline)}. An objection received after
                this date is not accepted.
              </p>
            ) : null}
          </div>

          <footer className="mt-10 border-t border-slate-300 pt-4 text-xs text-slate-500">
            <p>
              Recorded by {notice.createdBy ?? 'an authorised officer'} · Case ID{' '}
              <span className="font-mono">{acquisitionCase.id}</span>
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
