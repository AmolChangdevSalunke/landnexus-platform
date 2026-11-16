import { useState } from 'react'
import { History, KeyRound, MapPinned, Pencil, Plus, ShieldCheck, UserCog } from 'lucide-react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import { getRoles, getUserPermissions, getUsers, setUserEnabled, updateUserPermissions } from '../../../api/admin'
import type { UserResponse } from '../../../api/types'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { DataTable, type TableColumn } from '../../../components/ui/DataTable'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { formatDateTime } from '../../../utils/format'
import { PERMISSION } from '../../../utils/permissions'
import { useAuth } from '../../auth/useAuth'
import { UserCreateForm } from './UserCreateForm'
import { UserProfileForm } from './UserProfileForm'
import { UserRolesForm } from './UserRolesForm'
import { UserScopesDialog } from './UserScopesDialog'
import { UserPermissionsForm } from './UserPermissionsForm'
import { UserActivityDialog } from './UserActivityDialog'

type EditorState =
  | { mode: 'create' }
  | { mode: 'profile'; user: UserResponse }
  | { mode: 'roles'; user: UserResponse }
  | { mode: 'scopes'; user: UserResponse }
  | { mode: 'permissions'; user: UserResponse }
  | null

export function UsersPage() {
  const dispatch = useAppDispatch()
  const { user: currentUser, can, hasRole } = useAuth()
  const canWrite = can(PERMISSION.USER_WRITE)
  const canReadMaster = can(PERMISSION.MASTER_DATA_READ)
  const canAudit = can(PERMISSION.AUDIT_READ)
  const isSuperAdmin = hasRole('SUPER_ADMIN')

  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [editor, setEditor] = useState<EditorState>(null)
  const [statusTarget, setStatusTarget] = useState<UserResponse | null>(null)
  const [activityTarget, setActivityTarget] = useState<UserResponse | null>(null)
  const statusMutation = useApiMutation<UserResponse>()

  const usersQuery = useApiQuery(() => getUsers(page, size), [page, size])
  const rolesQuery = useApiQuery(() => getRoles(), [])

  const rows = usersQuery.data?.content ?? []
  const roles = rolesQuery.data ?? []
  const rolesReady = !rolesQuery.isLoading && rolesQuery.error === null && roles.length > 0

  function changeSize(next: number) {
    setSize(next)
    setPage(0)
  }

  function roleName(code: string): string {
    return roles.find((role) => role.code === code)?.name ?? code
  }

  function canManage(user: UserResponse): boolean {
    return canWrite && (isSuperAdmin || !user.roles.includes('SUPER_ADMIN'))
  }

  function isSelf(user: UserResponse): boolean {
    return currentUser?.id === user.id
  }

  async function changeStatus() {
    if (!statusTarget) {
      return
    }

    const nextEnabled = !statusTarget.enabled
    try {
      const saved = await statusMutation.mutate(() =>
        setUserEnabled(statusTarget.id, nextEnabled),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: `${saved.username} is now ${saved.enabled ? 'enabled' : 'disabled'}.`,
        }),
      )
      setStatusTarget(null)
      usersQuery.reload()
    } catch {
      // The mutation hook keeps the error; the dialog stays open.
    }
  }

  const columns: TableColumn<UserResponse>[] = [
    {
      key: 'user',
      header: 'User',
      render: (user) => (
        <div className="min-w-48">
          <p className="font-semibold text-navy-900">{user.fullName}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">@{user.username}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => <span className="break-all">{user.email}</span>,
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (user) => (
        <div className="flex max-w-72 flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-slate-400">No roles</span>
          ) : (
            user.roles.map((code) => (
              <Badge
                key={code}
                variant={code === 'SUPER_ADMIN' ? 'indigo' : 'info'}
              >
                <span title={roleName(code)}>{code}</span>
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <Badge variant={user.enabled ? 'success' : 'neutral'}>
          {user.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      render: (user) =>
        user.lastLoginAt ? (
          <span className="whitespace-nowrap" title={user.lastLoginAt}>
            {formatDateTime(user.lastLoginAt)}
          </span>
        ) : (
          <span className="text-slate-500">Never</span>
        ),
    },
  ]

  if (canWrite) {
    columns.push({
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      headerClassName: 'text-right',
      render: (user) => {
        const manageable = canManage(user)
        const self = isSelf(user)
        const blockedTitle = manageable
          ? undefined
          : 'Only a super administrator can change a SUPER_ADMIN account.'

        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditor({ mode: 'profile', user })}
              disabled={!manageable}
              title={blockedTitle}
              leftIcon={<Pencil aria-hidden="true" className="h-4 w-4" />}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditor({ mode: 'roles', user })}
              disabled={!manageable}
              title={blockedTitle}
              leftIcon={<UserCog aria-hidden="true" className="h-4 w-4" />}
            >
              Roles
            </Button>
            {isSuperAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditor({ mode: 'permissions', user })}
                disabled={user.roles.includes('SUPER_ADMIN')}
                title={user.roles.includes('SUPER_ADMIN') ? 'Super administrator permissions are protected.' : undefined}
                leftIcon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
              >
                Permissions
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditor({ mode: 'scopes', user })}
              title="Replace the complete geographic scope list."
              leftIcon={<MapPinned aria-hidden="true" className="h-4 w-4" />}
            >
              Scope
            </Button>
            <Button
              variant={user.enabled ? 'outline' : 'primary'}
              size="sm"
              onClick={() => setStatusTarget(user)}
              disabled={
                !manageable || (self && user.enabled)
              }
              title={
                self && user.enabled
                  ? 'You cannot disable your own account.'
                  : blockedTitle
              }
            >
              {user.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        )
      },
    })
  }

  if (canAudit) {
    columns.push({
      key: 'activity',
      header: 'History',
      className: 'text-right',
      render: (user) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActivityTarget(user)}
          leftIcon={<History aria-hidden="true" className="h-4 w-4" />}
        >
          Activity
        </Button>
      ),
    })
  }

  const emptyDescription = canWrite
    ? 'Create the first account with the button above.'
    : 'No accounts are visible to your role.'

  return (
    <>
      <PageHeader
        eyebrow="Administration · Access control"
        title="Users"
        description="Accounts from the backend. Role changes and geographic scope are enforced again by the server."
        actions={
          <>
            <Button
              variant="outline"
              onClick={usersQuery.reload}
              disabled={usersQuery.isLoading}
            >
              Refresh
            </Button>
            {canWrite ? (
              <Button
                onClick={() => setEditor({ mode: 'create' })}
                disabled={!rolesReady}
                title={
                  rolesReady
                    ? undefined
                    : 'The role list must load before an account can be created.'
                }
                leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
              >
                New user
              </Button>
            ) : null}
          </>
        }
      />

      {rolesQuery.error ? (
        <Alert variant="warning" title="Role list unavailable" className="mb-4">
          Role names cannot be resolved right now: {rolesQuery.error.message}
          {canWrite ? ' Creating and editing accounts is disabled until it loads.' : ''}
        </Alert>
      ) : null}

      {canWrite && !isSuperAdmin ? (
        <Alert variant="info" title="Super administrator accounts are protected" className="mb-4">
          You can manage other accounts, but only a SUPER_ADMIN can grant SUPER_ADMIN or change
          an account that already has it. The backend enforces this even if a request is sent.
        </Alert>
      ) : null}

      {usersQuery.data ? (
        <p className="mb-3 text-xs text-slate-500">
          {usersQuery.data.totalElements}{' '}
          {usersQuery.data.totalElements === 1 ? 'account' : 'accounts'} · {roles.length}{' '}
          {roles.length === 1 ? 'role' : 'roles'} available
        </p>
      ) : null}

      {usersQuery.error ? (
        <Card>
          <ErrorState
            title={
              usersQuery.error.status === 403 ? 'You do not have access' : 'Could not load users'
            }
            message={usersQuery.error.message}
            onRetry={usersQuery.reload}
          />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(user) => user.id}
          isLoading={usersQuery.isLoading}
          caption="User accounts"
          emptyTitle="No user accounts yet"
          emptyDescription={emptyDescription}
          page={usersQuery.data?.page ?? page}
          size={usersQuery.data?.size ?? size}
          totalElements={usersQuery.data?.totalElements ?? 0}
          totalPages={usersQuery.data?.totalPages}
          onPageChange={setPage}
          onSizeChange={changeSize}
        />
      )}

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">
          <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
          Access control
        </Badge>
        Passwords are never displayed. Disabling an account revokes its refresh tokens on the
        backend.
      </p>

      {editor?.mode === 'create' ? (
        <UserCreateForm
          roles={roles}
          allowSuperAdmin={isSuperAdmin}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            usersQuery.reload()
          }}
        />
      ) : null}

      {editor?.mode === 'profile' ? (
        <UserProfileForm
          user={editor.user}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            usersQuery.reload()
          }}
        />
      ) : null}

      {editor?.mode === 'roles' ? (
        <UserRolesForm
          user={editor.user}
          roles={roles}
          allowSuperAdmin={isSuperAdmin}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            usersQuery.reload()
          }}
        />
      ) : null}

      {editor?.mode === 'scopes' ? (
        <UserScopesDialog
          user={editor.user}
          roles={roles}
          canReadMaster={canReadMaster}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            usersQuery.reload()
          }}
        />
      ) : null}

      {editor?.mode === 'permissions' ? (
        <UserPermissionsForm
          user={editor.user}
          load={getUserPermissions}
          save={(id, overrides) => updateUserPermissions(id, { overrides })}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            usersQuery.reload()
          }}
        />
      ) : null}

      {activityTarget ? (
        <UserActivityDialog user={activityTarget} onClose={() => setActivityTarget(null)} />
      ) : null}

      {statusTarget ? (
        <ConfirmDialog
          title={`${statusTarget.enabled ? 'Disable' : 'Enable'} ${statusTarget.username}?`}
          message={
            <>
              <span className="font-semibold text-navy-900">{statusTarget.fullName}</span>
              {statusTarget.enabled
                ? ' will not be able to sign in, and existing refresh tokens are revoked.'
                : ' will be able to sign in again with the existing password.'}
              {statusMutation.error ? (
                <span role="alert" className="mt-2 block text-danger-700">
                  {statusMutation.error.message}
                </span>
              ) : null}
            </>
          }
          confirmLabel={statusTarget.enabled ? 'Disable account' : 'Enable account'}
          variant={statusTarget.enabled ? 'danger' : 'primary'}
          isLoading={statusMutation.isLoading}
          onConfirm={() => void changeStatus()}
          onClose={() => {
            if (!statusMutation.isLoading) {
              setStatusTarget(null)
            }
          }}
        />
      ) : null}
    </>
  )
}
