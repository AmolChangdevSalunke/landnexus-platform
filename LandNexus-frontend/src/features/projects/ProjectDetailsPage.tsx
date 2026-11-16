import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, FileText, Lock, Pencil, RotateCcw } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { toApiErrorInfo } from '../../api/errors'
import { closeProject, getProject, reopenProject } from '../../api/projects'
import type { ProjectResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CopyButton } from '../../components/ui/CopyButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import {
  formatArea,
  formatDateTime,
  formatLength,
  shortId,
} from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { AlignmentPanel } from '../gis/AlignmentPanel'
import { MapConflictsTab } from '../gis/MapConflictsTab'
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
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const refs = useReferenceNames()
  const { ensureDistrictVillages } = refs
  const [activeTab, setActiveTab] = useState('overview')
  const [statusAction, setStatusAction] = useState<'close' | 'reopen' | null>(null)
  const mutation = useApiMutation<ProjectResponse>()
  const canManage = can(PERMISSION.PROJECT_MANAGE)

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

  const projectId = project.id
  const villagesLoading = villageLoad.districtId === project.districtId && villageLoad.isLoading
  const villagesError =
    villageLoad.districtId === project.districtId ? villageLoad.error : null

  async function handleStatusChange() {
    if (!statusAction || mutation.isLoading) {
      return
    }
    try {
      await mutation.mutate(() =>
        statusAction === 'close' ? closeProject(projectId) : reopenProject(projectId),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: statusAction === 'close' ? 'Project closed.' : 'Project reopened.',
        }),
      )
      setStatusAction(null)
      query.reload()
    } catch {
      // The mutation keeps a safe error message for the alert below.
    }
  }

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
            {canManage ? (
              <LinkButton
                to={`/projects/${project.id}/edit`}
                variant="outline"
                leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}
              >
                Edit project
              </LinkButton>
            ) : null}
            {canManage && project.status === 'ACTIVE' ? (
              <Button
                variant="outline"
                leftIcon={<Lock aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setStatusAction('close')}
              >
                Close project
              </Button>
            ) : null}
            {canManage && project.status === 'CLOSED' ? (
              <Button
                variant="outline"
                leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setStatusAction('reopen')}
              >
                Reopen project
              </Button>
            ) : null}
          </>
        }
      />

      {mutation.error ? (
        <Alert
          variant="error"
          title={statusAction === 'close' ? 'The project was not closed' : 'The project was not reopened'}
          className="mb-4"
        >
          {mutation.error.message}
        </Alert>
      ) : null}

      {project.status === 'CLOSED' ? (
        <Alert variant="warning" title="Project closed" className="mb-4">
          This project is closed and read-only. Reopen it to correct its details again. The
          originating proposal and its approval record never change.
        </Alert>
      ) : canManage ? (
        <Alert variant="info" title="Project register" className="mb-4">
          This project was created automatically when its proposal was approved. You may correct
          its details, close it or reopen it; the code, originating proposal and approval facts
          stay unchanged and every change is audited.
        </Alert>
      ) : (
        <Alert variant="info" title="Read-only project" className="mb-4">
          This project was created automatically when its proposal was approved. Editing and
          closing need the PROJECT_MANAGE permission; ask an administrator if a correction is
          needed.
        </Alert>
      )}

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

      <Tabs
        label="Project sections"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
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
                            Village names are not available to this account, so identifiers are
                            shown.
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
                  <CardHeader
                    title="Linked records"
                    description="Identifiers come from the backend."
                  />
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
            ),
          },
          ...(can(PERMISSION.GIS_READ)
            ? [
                {
                  id: 'map',
                  label: 'Map and conflicts',
                  content: (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <LinkButton
                          to={`/gis/conflicts?project=${project.id}`}
                          variant="outline"
                          size="sm"
                          leftIcon={
                            <AlertTriangle
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                          }
                        >
                          Open conflict workspace
                        </LinkButton>
                      </div>
                      <MapConflictsTab project={project} />
                    </div>
                  ),
                },
                {
                  id: 'alignment',
                  label: 'Alignment',
                  content: <AlignmentPanel project={project} />,
                },
              ]
            : []),
        ]}
      />

      {statusAction ? (
        <ConfirmDialog
          title={statusAction === 'close' ? 'Close this project?' : 'Reopen this project?'}
          message={
            statusAction === 'close'
              ? 'A closed project is read-only. You can reopen it later; nothing is deleted and the audit trail keeps both changes.'
              : 'The project becomes active and editable again. The audit trail keeps both changes.'
          }
          confirmLabel={statusAction === 'close' ? 'Close project' : 'Reopen project'}
          variant={statusAction === 'close' ? 'danger' : 'primary'}
          isLoading={mutation.isLoading}
          onConfirm={handleStatusChange}
          onClose={() => setStatusAction(null)}
        />
      ) : null}
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
