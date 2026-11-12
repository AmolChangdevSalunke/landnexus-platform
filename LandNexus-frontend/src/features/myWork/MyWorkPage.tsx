import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ClipboardList,
  Database,
  FolderKanban,
  History,
  PlusCircle,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { getMyTasks } from '../../api/proposals'
import { useApiQuery } from '../../hooks/useApiQuery'
import { ROADMAP_MODULES } from '../../app/roadmapModules'
import { useAuth } from '../auth/useAuth'
import { useDistrictCount } from '../auth/useDistrictCount'
import { PERMISSION, PROPOSAL_READ_ANY } from '../../utils/permissions'
import { formatArea, formatDateTime } from '../../utils/format'
import { formatRole } from '../../utils/strings'
import { ASSIGNMENT_STAGE_LABELS } from '../proposals/labels'

const ScopeMap = lazy(() =>
  import('./ScopeMap').then((module) => ({ default: module.ScopeMap })),
)

interface QuickAction {
  to: string
  title: string
  description: string
  icon: LucideIcon
}

export function MyWorkPage() {
  const { user, can, canAny } = useAuth()
  const districts = useDistrictCount()
  const canReadProposals = canAny(...PROPOSAL_READ_ANY)

  const tasksQuery = useApiQuery(
    () => getMyTasks(0, 50),
    [],
    Boolean(user) && canReadProposals,
  )

  if (!user) {
    return null
  }
  const displayName = user.fullName || user.username
  const canCreateProposal = can(PERMISSION.PROPOSAL_CREATE)
  const canReadAdmin = can(PERMISSION.MASTER_DATA_READ)
  const canReadUsers = can(PERMISSION.USER_READ)
  const canReadAudit = can(PERMISSION.AUDIT_READ)

  const quickActions: QuickAction[] = []

  if (canCreateProposal) {
    quickActions.push({
      to: '/proposals/new',
      title: 'New proposal',
      description: 'Create a draft for a district in your scope.',
      icon: PlusCircle,
    })
  }
  if (canReadProposals) {
    quickActions.push({
      to: '/projects',
      title: 'Projects',
      description: 'Projects created from approved proposals.',
      icon: FolderKanban,
    })
  }

  const adminActions: QuickAction[] = []
  if (canReadAdmin) {
    adminActions.push({
      to: '/admin/master/ministries',
      title: 'Master data',
      description: 'Ministries, departments and administrative geography.',
      icon: Database,
    })
  }
  if (canReadUsers) {
    adminActions.push({
      to: '/admin/users',
      title: 'Users',
      description: 'Accounts, roles and geographic scope.',
      icon: Users,
    })
    adminActions.push({
      to: '/admin/roles',
      title: 'Roles and permissions',
      description: 'Read-only role and permission matrix.',
      icon: ShieldCheck,
    })
  }
  if (canReadAudit) {
    adminActions.push({
      to: '/admin/audit',
      title: 'Audit trail',
      description: 'Append-only record of platform activity.',
      icon: ClipboardList,
    })
    adminActions.push({
      to: '/admin/logins',
      title: 'Login history',
      description: 'Successful and failed sign-in attempts.',
      icon: History,
    })
  }

  const districtValue = !districts.enabled
    ? 'N/A'
    : districts.isLoading
      ? '…'
      : (districts.total ?? '—')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">My work</h1>

      {canReadProposals ? (
        <Card className="p-5">
          <CardHeader
            title="My tasks"
            description="Proposals assigned to you by automatic routing. Overdue tasks are marked in words as well as colour."
            action={
              <LinkButton to="/proposals" variant="outline" size="sm">
                All proposals
              </LinkButton>
            }
          />
          <div className="mt-4">
            {tasksQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tasksQuery.error ? (
              <ErrorState
                title="Could not load your tasks"
                message={tasksQuery.error.message}
                onRetry={tasksQuery.reload}
              />
            ) : (tasksQuery.data?.content ?? []).length === 0 ? (
              <EmptyState
                title="No open tasks"
                description="Scrutiny and decision assignments appear here when a proposal is routed to you."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <th scope="col" className="px-3 py-2 font-semibold">Proposal</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Stage</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Assigned</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Due</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tasksQuery.data?.content ?? []).map((task) => (
                      <tr key={task.assignmentId} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 align-top">
                          <p className="font-semibold text-navy-900">
                            {task.proposalNumber ?? task.title ?? 'Proposal'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {task.title ?? 'No title'}
                            {task.estimatedLandAreaHa != null
                              ? ` · ${formatArea(task.estimatedLandAreaHa)}`
                              : ''}
                            {task.districtName ? ` · ${task.districtName}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {ASSIGNMENT_STAGE_LABELS[task.stage]}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {task.overdue ? (
                            <Badge variant="danger">Overdue</Badge>
                          ) : task.assignmentStatus === 'IN_PROGRESS' ? (
                            <Badge variant="info">In progress</Badge>
                          ) : (
                            <Badge variant="neutral">Pending</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {formatDateTime(task.assignedAt)}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700">
                          {task.dueAt ? formatDateTime(task.dueAt) : 'No due date'}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Link
                            to={`/proposals/${task.proposalId}`}
                            className="font-semibold text-blue-700 hover:text-blue-800"
                          >
                            Open proposal
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <CardHeader
            title="Quick actions"
            description="Screens available to your role. The backend still checks every action."
            action={<Badge variant="info">Permission based</Badge>}
          />

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/50 hover:no-underline"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-navy-900">{action.title}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                      {action.description}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Administration
            </p>
            {adminActions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {adminActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <LinkButton
                      key={action.to}
                      to={action.to}
                      variant="outline"
                      size="sm"
                      leftIcon={<Icon aria-hidden="true" className="h-4 w-4" />}
                    >
                      {action.title}
                    </LinkButton>
                  )
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                No administration screens are assigned to your role.
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Suspense
            fallback={
              <Card className="flex min-h-[340px] items-center justify-center p-4 text-sm text-slate-500">
                Loading map…
              </Card>
            }
          >
            <ScopeMap />
          </Suspense>

          <Card className="p-5">
            <CardHeader title="Access and scope" description="From /auth/me and my-districts." />

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Signed in as
                </p>
                <p className="mt-1 text-sm font-semibold text-navy-900">{displayName}</p>
                <p className="break-all text-xs leading-5 text-slate-500">
                  @{user.username} · {user.email}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Roles
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <Badge key={role} variant="info">
                        {formatRole(role)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-600">No role assigned</span>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Permissions
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-navy-900">
                    {user.permissions.length}
                  </dd>
                  <dd className="text-xs text-slate-500">Assigned by the backend</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Districts
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-navy-900">{districtValue}</dd>
                  <dd className="text-xs text-slate-500">
                    {districts.enabled ? 'In your scope' : 'Not applicable'}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <CardHeader
          title="Platform modules"
          description="Planned capabilities. No demo data or placeholder counts are shown."
          action={<Badge variant="neutral">Roadmap</Badge>}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(ROADMAP_MODULES).map(([key, module]) => {
            const Icon = module.icon
            return (
              <Link
                key={key}
                to={`/roadmap/${key}`}
                className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/40 hover:no-underline"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-700">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold text-navy-900">{module.title}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                      Planned
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                    {module.summary}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
