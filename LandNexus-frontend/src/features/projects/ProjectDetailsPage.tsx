import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { toApiErrorInfo } from '../../api/errors'
import { getProject } from '../../api/projects'
import type { ProjectResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
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
  formatDateTime,
  formatLength,
  shortId,
} from '../../utils/format'
import { PROJECT_TYPE_LABELS } from '../proposals/labels'
import { ProjectStatusBadge } from './ProjectStatusBadge'

function ProjectDetailsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  )
}

export function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const refs = useReferenceNames()
  const { ensureDistrictVillages } = refs

  const query = useApiQuery<ProjectResponse | null>(
    () => (id ? getProject(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  const project = query.data
  const districtId = project?.districtId ?? ''
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

  if (query.isLoading) {
    return <ProjectDetailsSkeleton />
  }

  if (query.error) {
    return (
      <>
        <PageHeader
          eyebrow="Module 2 · Government projects"
          title="Project"
          description="The project could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              query.error.status === 404
                ? 'Project not found'
                : query.error.status === 403
                  ? 'You do not have access'
                  : 'Could not load project'
            }
            message={query.error.message}
            onRetry={query.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/projects" variant="outline">
              Back to projects
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  if (!project) {
    return (
      <>
        <PageHeader
          eyebrow="Module 2 · Government projects"
          title="Project"
          description="The project could not be found."
        />
        <Card>
          <EmptyState
            title="Project not found"
            description="It may not exist, or you may not have access to it."
            action={
              <LinkButton to="/projects" variant="outline">
                Back to projects
              </LinkButton>
            }
          />
        </Card>
      </>
    )
  }

  const villagesLoading = villageLoad.districtId === project.districtId && villageLoad.isLoading
  const villagesError =
    villageLoad.districtId === project.districtId ? villageLoad.error : null

  return (
    <>
      <PageHeader
        eyebrow="Module 2 · Government projects"
        title={project.title}
        description={`Project ${project.code} · ${PROJECT_TYPE_LABELS[project.projectType]}`}
        actions={
          <>
            <LinkButton
              to="/projects"
              variant="outline"
              leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
            >
              All projects
            </LinkButton>
            <LinkButton
              to={`/proposals/${project.proposalId}`}
              leftIcon={<FileText aria-hidden="true" className="h-4 w-4" />}
            >
              Originating proposal
            </LinkButton>
          </>
        }
      />

      <Alert variant="info" title="Read-only project" className="mb-4">
        This project was created automatically when its proposal was approved. It cannot be
        created, edited or deleted from the project register.
      </Alert>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ProjectStatusBadge status={project.status} />
              <Badge variant="neutral">Government project</Badge>
            </div>
            <p className="mt-2 font-mono text-base font-semibold text-navy-900">{project.code}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <span className="font-mono">{project.id}</span>
              <CopyButton value={project.id} label="project id" />
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Approved
              </dt>
              <dd className="mt-0.5 text-slate-700">{formatDateTime(project.approvedAt)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Approved by
              </dt>
              <dd className="mt-0.5 text-slate-700" title={project.approvedByUserId}>
                {shortId(project.approvedByUserId)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Created
              </dt>
              <dd className="mt-0.5 text-slate-700">{formatDateTime(project.createdAt)}</dd>
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
        <Card className="p-5 xl:col-span-2">
          <CardHeader
            title="Project details"
            description="Values stored by the backend. Nothing is calculated on this page."
          />

          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailItem label="Project type">
              {PROJECT_TYPE_LABELS[project.projectType]}
            </DetailItem>
            <DetailItem label="Department">
              {refs.departmentName(project.departmentId) ?? shortId(project.departmentId)}
            </DetailItem>
            <DetailItem label="State">
              {refs.stateName(project.stateId) ?? shortId(project.stateId)}
            </DetailItem>
            <DetailItem label="District">
              {refs.districtName(project.districtId) ?? shortId(project.districtId)}
            </DetailItem>
            <DetailItem label="Taluka">
              {project.talukaId
                ? (refs.talukaName(project.talukaId) ?? shortId(project.talukaId))
                : 'No specific taluka'}
            </DetailItem>
            <DetailItem label="Length">{formatLength(project.lengthKm)}</DetailItem>
            <DetailItem label="Estimated land area">
              {formatArea(project.estimatedLandAreaHa)}
            </DetailItem>
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Affected villages ({project.villageIds.length})
              </dt>
              <dd className="mt-2">
                {project.villageIds.length === 0 ? (
                  <p className="text-sm text-slate-600">No villages recorded.</p>
                ) : (
                  <ul className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                    {project.villageIds.map((villageId) => (
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
          </dl>
        </Card>

        <Card className="p-4">
          <CardHeader title="Linked records" description="Identifiers come from the backend." />
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Project id
              </dt>
              <dd className="mt-0.5 flex items-center gap-1 break-all font-mono text-xs text-slate-700">
                {project.id}
                <CopyButton value={project.id} label="project id" />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Originating proposal
              </dt>
              <dd className="mt-1">
                <LinkButton
                  to={`/proposals/${project.proposalId}`}
                  variant="outline"
                  size="sm"
                >
                  Open proposal
                </LinkButton>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Proposal id
              </dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">
                {project.proposalId}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Owner
              </dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">
                {project.ownerUserId}
              </dd>
            </div>
          </dl>
        </Card>
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
