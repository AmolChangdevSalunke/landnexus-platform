import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, ShieldCheck } from 'lucide-react'
import { toApiErrorInfo } from '../../api/errors'
import {
  getProposal,
  getProposalAssignments,
  getProposalHistory,
  getProposalValidation,
  getProposalVersions,
} from '../../api/proposals'
import type {
  ProposalAssignment,
  ProposalHistoryEntry,
  ProposalResponse,
  ProposalValidationResponse,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import {
  formatArea,
  formatDate,
  formatDateTime,
  formatLength,
  shortId,
} from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { ActionBar } from './ActionBar'
import {
  PROPOSAL_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  historyActionLabel,
} from './labels'
import { StatusBadge } from './StatusBadge'
import { NlamsStageStepper } from './NlamsStageStepper'
import { VersionViewer } from './VersionViewer'

const EDITABLE_STATUSES = new Set(['DRAFT', 'CLARIFICATION_REQUESTED'])

function ProposalDetailsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  )
}

export function ProposalDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { user, can } = useAuth()
  const refs = useReferenceNames()
  const { ensureDistrictVillages } = refs

  const proposalQuery = useApiQuery<ProposalResponse | null>(
    () => (id ? getProposal(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  const proposal = proposalQuery.data
  const ready = Boolean(proposal)

  const historyQuery = useApiQuery<ProposalHistoryEntry[]>(
    () => (id ? getProposalHistory(id) : Promise.resolve([])),
    [id],
    ready,
  )

  const versionsQuery = useApiQuery(
    () => (id ? getProposalVersions(id) : Promise.resolve([])),
    [id],
    ready,
  )

  const validationQuery = useApiQuery<ProposalValidationResponse | null>(
    () => (id ? getProposalValidation(id) : Promise.resolve(null)),
    [id],
    ready,
  )

  const assignmentsQuery = useApiQuery<ProposalAssignment[]>(
    () => (id ? getProposalAssignments(id) : Promise.resolve([])),
    [id],
    ready,
  )

  const reloadProposal = proposalQuery.reload
  const reloadHistory = historyQuery.reload
  const reloadVersions = versionsQuery.reload
  const reloadValidation = validationQuery.reload
  const reloadAssignments = assignmentsQuery.reload

  const reloadAll = useCallback(() => {
    reloadProposal()
    reloadHistory()
    reloadVersions()
    reloadValidation()
    reloadAssignments()
  }, [reloadProposal, reloadHistory, reloadVersions, reloadValidation, reloadAssignments])

  const districtId = proposal?.districtId ?? ''
  const [villageLoad, setVillageLoad] = useState<{
    districtId: string
    isLoading: boolean
    error: string | null
  }>({ districtId: '', isLoading: false, error: null })

  useEffect(() => {
    if (!districtId || !refs.enabled) {
      setVillageLoad({ districtId: '', isLoading: false, error: null })
      return
    }

    let active = true
    setVillageLoad({ districtId, isLoading: true, error: null })

    ensureDistrictVillages(districtId)
      .then(() => {
        if (active) {
          setVillageLoad({ districtId, isLoading: false, error: null })
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setVillageLoad({
            districtId,
            isLoading: false,
            error: toApiErrorInfo(caught).message,
          })
        }
      })

    return () => {
      active = false
    }
  }, [districtId, ensureDistrictVillages, refs.enabled])

  if (proposalQuery.isLoading) {
    return <ProposalDetailsSkeleton />
  }

  if (proposalQuery.error) {
    return (
      <>
        <PageHeader
          eyebrow="Module 2 · Consultant proposals"
          title="Proposal"
          description="The proposal could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              proposalQuery.error.status === 404
                ? 'Proposal not found'
                : proposalQuery.error.status === 403
                  ? 'You do not have access'
                  : 'Could not load proposal'
            }
            message={proposalQuery.error.message}
            onRetry={proposalQuery.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/proposals" variant="outline">
              Back to proposals
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  if (!proposal) {
    return (
      <>
        <PageHeader
          eyebrow="Module 2 · Consultant proposals"
          title="Proposal"
          description="The proposal could not be found."
        />
        <Card>
          <EmptyState
            title="Proposal not found"
            description="It may not exist, or you may not have access to it."
            action={
              <LinkButton to="/proposals" variant="outline">
                Back to proposals
              </LinkButton>
            }
          />
        </Card>
      </>
    )
  }

  const canEdit =
    can(PERMISSION.PROPOSAL_CREATE) &&
    proposal.ownerUserId === user?.id &&
    EDITABLE_STATUSES.has(proposal.status)

  const villagesLoading = villageLoad.districtId === proposal.districtId && villageLoad.isLoading
  const villagesError =
    villageLoad.districtId === proposal.districtId ? villageLoad.error : null
  const ownerLabel =
    proposal.ownerUserId === user?.id ? 'You' : shortId(proposal.ownerUserId)

  return (
    <>
      <PageHeader
        eyebrow="Module 2 · Consultant proposals"
        title={proposal.title}
        description={
          proposal.proposalNumber
            ? `Proposal ${proposal.proposalNumber} · ${PROJECT_TYPE_LABELS[proposal.projectType]}`
            : `${PROJECT_TYPE_LABELS[proposal.projectType]} · Draft, proposal number is assigned on submission`
        }
        actions={
          <>
            <LinkButton
              to="/proposals"
              variant="outline"
              leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
            >
              All proposals
            </LinkButton>
            {canEdit ? (
              <LinkButton
                to={`/proposals/${proposal.id}/edit`}
                leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}
              >
                Edit draft
              </LinkButton>
            ) : null}
          </>
        }
      />

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={proposal.status} />
              <Badge variant="neutral">Version {proposal.versionNo}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {proposal.proposalNumber ? (
                <span className="font-mono font-semibold text-navy-900">
                  {proposal.proposalNumber}
                </span>
              ) : (
                'No proposal number yet. It is assigned when the draft is submitted.'
              )}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <span className="font-mono">{proposal.id}</span>
              <CopyButton value={proposal.id} label="proposal id" />
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Owner
              </dt>
              <dd className="mt-0.5 font-medium text-navy-900" title={proposal.ownerUserId}>
                {ownerLabel}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Submitted
              </dt>
              <dd className="mt-0.5 text-slate-700">
                {proposal.submittedAt ? formatDateTime(proposal.submittedAt) : 'Not yet'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Updated
              </dt>
              <dd className="mt-0.5 text-slate-700">{formatDateTime(proposal.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {refs.enabled && refs.error ? (
        <Alert variant="warning" title="Reference names are not available" className="mb-4">
          District, department and village names could not be loaded, so identifiers are shown
          instead. {refs.error.message}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-5">
            <CardHeader
              title="Proposal details"
              description="Values stored by the backend. Nothing is calculated on this page."
            />

            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailItem label="Project type">
                {PROJECT_TYPE_LABELS[proposal.projectType]}
              </DetailItem>
              <DetailItem label="Department">
                {refs.departmentName(proposal.departmentId) ?? shortId(proposal.departmentId)}
              </DetailItem>
              <DetailItem label="State">
                {refs.stateName(proposal.stateId) ?? shortId(proposal.stateId)}
              </DetailItem>
              <DetailItem label="District">
                {refs.districtName(proposal.districtId) ?? shortId(proposal.districtId)}
              </DetailItem>
              <DetailItem label="Taluka">
                {proposal.talukaId
                  ? (refs.talukaName(proposal.talukaId) ?? shortId(proposal.talukaId))
                  : 'No specific taluka'}
              </DetailItem>
              <DetailItem label="Length">{formatLength(proposal.lengthKm)}</DetailItem>
              <DetailItem label="Estimated land area">
                {formatArea(proposal.estimatedLandAreaHa)}
              </DetailItem>
              <DetailItem label="Planned start">{formatDate(proposal.plannedStartDate)}</DetailItem>
              <DetailItem label="Planned end">{formatDate(proposal.plannedEndDate)}</DetailItem>
              <DetailItem label="Alignment description">
                {proposal.alignmentDescription || 'Not provided'}
              </DetailItem>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Affected villages ({proposal.villageIds.length})
                </dt>
                <dd className="mt-2">
                  {proposal.villageIds.length === 0 ? (
                    <p className="text-sm text-slate-600">No villages recorded.</p>
                  ) : (
                    <ul className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                      {proposal.villageIds.map((villageId) => (
                        <li
                          key={villageId}
                          title={villageId}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {refs.villageName(villageId) ?? shortId(villageId)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {villagesLoading ? (
                    <p className="mt-2 text-xs text-slate-500">Loading village names…</p>
                  ) : null}
                  {!refs.enabled ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Village names are not available to this account, so identifiers are shown.
                    </p>
                  ) : null}
                  {villagesError ? (
                    <p role="alert" className="mt-2 text-xs font-medium text-danger-700">
                      Village names could not be loaded. {villagesError}
                    </p>
                  ) : null}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Description
                </dt>
                <dd className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {proposal.description}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <CardHeader
              title="NLAMS workflow"
              description="Automated routing journey. Assignment details come from the backend."
            />
            <div className="mt-4">
              <NlamsStageStepper
                status={proposal.status}
                assignments={assignmentsQuery.data ?? []}
              />
              {assignmentsQuery.error ? (
                <p role="alert" className="mt-3 text-xs font-medium text-danger-700">
                  Assignment details could not be loaded. {assignmentsQuery.error.message}
                </p>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader
              title="History"
              description="Every status change with the actor, time and recorded reason."
              action={
                <Button variant="outline" size="sm" onClick={reloadHistory} disabled={historyQuery.isLoading}>
                  Refresh
                </Button>
              }
            />

            <div className="mt-4">
              {historyQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : historyQuery.error ? (
                <ErrorState
                  title="Could not load history"
                  message={historyQuery.error.message}
                  onRetry={reloadHistory}
                />
              ) : (historyQuery.data ?? []).length === 0 ? (
                <EmptyState
                  title="No history yet"
                  description="Status changes appear here after the proposal is submitted."
                />
              ) : (
                <ol className="space-y-3">
                  {[...(historyQuery.data ?? [])].reverse().map((entry) => (
                    <HistoryRow key={entry.id} entry={entry} />
                  ))}
                </ol>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader
              title="Versions"
              description="Frozen snapshots stored when the proposal was submitted or resubmitted."
              action={
                <Button variant="outline" size="sm" onClick={reloadVersions} disabled={versionsQuery.isLoading}>
                  Refresh
                </Button>
              }
            />

            <div className="mt-2">
              {versionsQuery.isLoading ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : versionsQuery.error ? (
                <ErrorState
                  title="Could not load versions"
                  message={versionsQuery.error.message}
                  onRetry={reloadVersions}
                />
              ) : (
                <VersionViewer versions={versionsQuery.data ?? []} />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <ActionBar proposal={proposal} onUpdated={() => reloadAll()} onReload={reloadAll} />

          <Card className="p-4">
            <CardHeader
              title="DGOR validation"
              description="System-assisted validation of mandatory fields, location, and supporting information."
              action={
                <Button variant="outline" size="sm" onClick={reloadValidation} disabled={validationQuery.isLoading}>
                  <ShieldCheck aria-hidden="true" className="mr-1.5 h-4 w-4" />
                  Revalidate
                </Button>
              }
            />
            <div className="mt-3">
              {validationQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : validationQuery.error ? (
                <ErrorState
                  title="Could not load validation"
                  message={validationQuery.error.message}
                  onRetry={reloadValidation}
                />
              ) : validationQuery.data ? (
                <ValidationSummary validation={validationQuery.data} />
              ) : (
                <EmptyState title="No validation result" description="Validation results will appear here." />
              )}
            </div>
          </Card>

          {proposal.projectCode ? (
            <Card className="p-4">
              <CardHeader
                title="Government project"
                description="Created automatically when this proposal was approved."
              />
              <p className="mt-3 text-sm text-slate-600">Project code</p>
              <Link
                to="/projects"
                className="mt-1 inline-block font-mono text-base font-semibold text-blue-700 hover:text-blue-800"
                aria-label={`Go to the project register to find project ${proposal.projectCode}`}
              >
                {proposal.projectCode}
              </Link>
              {proposal.acquisitionCaseNumber ? (
                <>
                  <p className="mt-3 text-sm text-slate-600">Acquisition case</p>
                  <p className="mt-1 font-mono text-base font-semibold text-navy-900">
                    {proposal.acquisitionCaseNumber}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    The acquisition case was initiated automatically after approval. Open Acquisition to continue survey, notices, award, possession, and R&amp;R tracking.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  The project register is read-only. Open it to find this project, its details and the link back to this proposal.
                </p>
              )}
            </Card>
          ) : null}

          <Card className="p-4">
            <CardHeader title="Record" description="Identifiers come from the backend." />
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Proposal id
                </dt>
                <dd className="mt-0.5 flex items-center gap-1 break-all font-mono text-xs text-slate-700">
                  {proposal.id}
                  <CopyButton value={proposal.id} label="proposal id" />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusBadge status={proposal.status} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Created
                </dt>
                <dd className="mt-0.5 text-slate-700">{formatDateTime(proposal.createdAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  )
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm leading-6 text-slate-700">{children}</dd>
    </div>
  )
}

function HistoryRow({ entry }: { entry: ProposalHistoryEntry }) {
  const transition = entry.fromStatus
    ? `${PROPOSAL_STATUS_LABELS[entry.fromStatus]} → ${PROPOSAL_STATUS_LABELS[entry.toStatus]}`
    : `Created as ${PROPOSAL_STATUS_LABELS[entry.toStatus]}`

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy-900">
            {historyActionLabel(entry.action)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{transition}</p>
        </div>
        <p className="text-xs text-slate-500" title={entry.occurredAt}>
          {formatDateTime(entry.occurredAt)}
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">By {entry.actorUsername}</p>
      {entry.reason ? (
        <p className="mt-2 whitespace-pre-line rounded-md bg-slate-50 px-2.5 py-2 text-sm text-slate-700">
          {entry.reason}
        </p>
      ) : null}
    </li>
  )
}

function ValidationSummary({ validation }: { validation: ProposalValidationResponse }) {
  const failures = validation.items.filter((i) => i.severity === 'FAIL')
  const warnings = validation.items.filter((i) => i.severity === 'WARN')
  return (
    <div className="space-y-3">
      <Alert variant={validation.passed ? 'success' : 'error'}>
        {validation.passed
          ? 'Mandatory validation checks passed. Warnings may still require attention.'
          : `Validation failed with ${failures.length} mandatory issue(s). Resolve them before submission.`}
      </Alert>
      <div className="space-y-2">
        {validation.items.map((item) => (
          <div
            key={item.code}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-navy-900">{item.code.replaceAll('_', ' ')}</span>
              <Badge
                variant={
                  item.severity === 'PASS' ? 'success' : item.severity === 'WARN' ? 'warning' : 'danger'
                }
              >
                {item.severity}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">{item.message}</p>
          </div>
        ))}
      </div>
      {(warnings.length > 0 || failures.length > 0) && (
        <p className="text-xs text-slate-500">
          {failures.length} fail, {warnings.length} warning, {validation.items.length - failures.length - warnings.length} pass.
        </p>
      )}
    </div>
  )
}
