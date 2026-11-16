import { useMemo, useState } from 'react'
import { ShieldCheck, UserCog } from 'lucide-react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import {
  getAuditEvents,
  getPermissions,
  getRoles,
  updateRolePermissions,
} from '../../../api/admin'
import type { AuditEventResponse, PermissionResponse, RoleResponse } from '../../../api/types'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card, CardHeader } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Modal } from '../../../components/ui/Modal'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { PERMISSION } from '../../../utils/permissions'
import { useAuth } from '../../auth/useAuth'

export function RolesPage() {
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canManage = can(PERMISSION.ROLE_MANAGE)
  const canReadAudit = can(PERMISSION.AUDIT_READ)
  const rolesQuery = useApiQuery(() => getRoles(), [])
  const permissionsQuery = useApiQuery(() => getPermissions(), [], canManage)
  const historyQuery = useApiQuery(
    () => getAuditEvents({ entityType: 'Role', size: 20 }),
    [],
    canReadAudit,
  )
  const mutation = useApiMutation<RoleResponse>()
  const roles = rolesQuery.data ?? []
  const permissions = permissionsQuery.data ?? []
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)

  const permissionCodes = useMemo(() => {
    const all = new Set(permissions.map((permission) => permission.code))
    for (const role of roles) {
      for (const permission of role.permissions) {
        all.add(permission)
      }
    }
    return [...all].sort((left, right) => left.localeCompare(right))
  }, [permissions, roles])

  const permissionByCode = useMemo(
    () => new Map(permissions.map((permission) => [permission.code, permission])),
    [permissions],
  )

  function beginEdit(role: RoleResponse) {
    setEditingRole(role)
    setSelectedPermissions(role.permissions)
    mutation.reset()
  }

  function closeEditor() {
    if (!mutation.isLoading) {
      setEditingRole(null)
      setConfirming(false)
    }
  }

  function togglePermission(code: string) {
    setSelectedPermissions((current) =>
      current.includes(code)
        ? current.filter((permission) => permission !== code)
        : [...current, code],
    )
  }

  async function savePermissions() {
    if (!editingRole || mutation.isLoading) {
      return
    }
    try {
      const saved = await mutation.mutate(() =>
        updateRolePermissions(editingRole.id, selectedPermissions),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: `Permissions updated for ${saved.code}.`,
        }),
      )
      rolesQuery.reload()
      setConfirming(false)
      setEditingRole(null)
    } catch {
      setConfirming(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration · Access control"
        title="Roles and permissions"
        description="Review the role catalogue and permission matrix. Permission changes are audited and enforced by the backend."
      />

      {canManage ? (
        <Alert variant="warning" title="Sensitive access configuration" className="mb-4">
          Only a role with ROLE_MANAGE can save changes. Permission changes invalidate affected
          users' existing access tokens; they must sign in again to continue.
        </Alert>
      ) : (
        <Alert variant="info" title="Read-only reference data" className="mb-4">
          Your account can review role permissions but cannot change them. User role assignment
          is managed separately on the Users screen.
        </Alert>
      )}

      {rolesQuery.error ? (
        <Card>
          <ErrorState
            title={rolesQuery.error.status === 403 ? 'You do not have access' : 'Could not load roles'}
            message={rolesQuery.error.message}
            onRetry={rolesQuery.reload}
          />
        </Card>
      ) : rolesQuery.isLoading ? (
        <Card className="space-y-3 p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ) : roles.length === 0 ? (
        <Card>
          <div className="px-6 py-10 text-center text-sm text-slate-600">
            No roles are available to your account.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</p>
              <p className="mt-1 text-2xl font-bold text-navy-900">{roles.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Distinct permissions
              </p>
              <p className="mt-1 text-2xl font-bold text-navy-900">{permissionCodes.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Highest access
              </p>
              <p className="mt-1 text-2xl font-bold text-navy-900">
                {Math.max(...roles.map((role) => role.permissions.length))}
              </p>
              <p className="text-xs text-slate-500">permissions on one role</p>
            </Card>
          </div>

          <Card className="p-5">
            <CardHeader
              title="Role catalogue"
              description="Roles and permissions returned by the administration API."
              action={
                canManage ? (
                  <Badge variant="success">Role administration enabled</Badge>
                ) : (
                  <Badge variant="neutral">Read only</Badge>
                )
              }
            />
            <ul className="mt-4 divide-y divide-slate-100">
              {roles.map((role) => (
                <li
                  key={role.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900">
                      {role.name}{' '}
                      <span className="font-mono text-xs text-slate-500">{role.code}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">{role.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="flex max-w-xl flex-wrap gap-1">
                      {role.permissions.length === 0 ? (
                        <span className="text-xs text-slate-400">No permissions</span>
                      ) : (
                        role.permissions.map((permission) => (
                          <Badge key={permission} variant="info">{permission}</Badge>
                        ))
                      )}
                    </div>
                    {canManage ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => beginEdit(role)}
                        leftIcon={<UserCog aria-hidden="true" className="h-4 w-4" />}
                      >
                        Edit permissions
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <CardHeader
                title="Permission matrix"
                description="A filled cell means the role currently contains that permission code."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <caption className="sr-only">Role and permission matrix</caption>
                <thead>
                  <tr className="bg-slate-50">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Role
                    </th>
                    {permissionCodes.map((permission) => (
                      <th
                        key={permission}
                        scope="col"
                        title={permissionByCode.get(permission)?.description}
                        className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {permission}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-slate-50">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-left font-semibold text-navy-900"
                      >
                        {role.code}
                        <span className="block text-xs font-normal text-slate-500">{role.name}</span>
                      </th>
                      {permissionCodes.map((permission) => {
                        const granted = role.permissions.includes(permission)
                        return (
                          <td
                            key={permission}
                            className="px-3 py-3 text-center"
                            aria-label={`${role.code} ${granted ? 'has' : 'does not have'} ${permission}`}
                          >
                            {granted ? (
                              <span className="text-success-700">✓</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {canReadAudit ? (
            <Card className="p-5">
              <CardHeader
                title="Role and permission change history"
                description="Recent role-permission changes recorded by the backend audit trail."
              />
              {historyQuery.error ? (
                <ErrorState
                  title="Could not load role history"
                  message={historyQuery.error.message}
                  onRetry={historyQuery.reload}
                />
              ) : historyQuery.isLoading ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (historyQuery.data?.content.length ?? 0) === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No role or permission changes recorded.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {historyQuery.data?.content.map((event) => (
                    <RoleHistoryRow key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      )}

      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
          Server-enforced
        </Badge>
        Every permission update is audited; frontend controls are not an authorization boundary.
      </p>

      {editingRole ? (
        <Modal
          title={`Edit permissions · ${editingRole.code}`}
          description="This replaces the complete permission set for the selected role."
          onClose={closeEditor}
          size="lg"
          footer={
            <>
              <Button variant="outline" onClick={closeEditor} disabled={mutation.isLoading}>
                Cancel
              </Button>
              <Button
                onClick={() => setConfirming(true)}
                disabled={
                  mutation.isLoading ||
                  permissionsQuery.isLoading ||
                  permissionsQuery.error !== null ||
                  permissions.length === 0
                }
              >
                Review and save
              </Button>
            </>
          }
        >
          {permissionsQuery.error ? (
            <ErrorState
              title="Could not load the permission catalogue"
              message={permissionsQuery.error.message}
              onRetry={permissionsQuery.reload}
            />
          ) : permissionsQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              {mutation.error ? (
                <Alert variant="error" title="Permissions were not saved" className="mb-4">
                  {mutation.error.message}
                </Alert>
              ) : null}
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <Badge variant="info">{selectedPermissions.length} selected</Badge>
                <span>Changes are recorded in the audit trail.</span>
              </div>
              <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200">
                <ul className="divide-y divide-slate-100">
                  {permissions.map((permission) => {
                    const checked = selectedPermissions.includes(permission.code)
                    const protectedSuperAdminPermission =
                      editingRole.code === 'SUPER_ADMIN' &&
                      permission.code === PERMISSION.ROLE_MANAGE
                    return (
                      <PermissionOption
                        key={permission.id}
                        permission={permission}
                        checked={checked}
                        disabled={protectedSuperAdminPermission || mutation.isLoading}
                        onChange={() => togglePermission(permission.code)}
                      />
                    )
                  })}
                </ul>
              </div>
            </>
          )}
        </Modal>
      ) : null}

      {confirming && editingRole ? (
        <ConfirmDialog
          title="Confirm role permission change"
          confirmLabel="Apply permission changes"
          isLoading={mutation.isLoading}
          onClose={() => setConfirming(false)}
          onConfirm={() => void savePermissions()}
          message={
            <span>
              Replace the permissions for <strong>{editingRole.code}</strong> with the selected
              set? The change is audited and invalidates access tokens for users assigned to this
              role.
            </span>
          }
        />
      ) : null}
    </>
  )
}

function RoleHistoryRow({ event }: { event: AuditEventResponse }) {
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="font-medium text-navy-900">{event.action}</p>
        <p className="text-sm text-slate-600">{event.details ?? 'No additional details'}</p>
      </div>
      <p className="shrink-0 text-xs text-slate-500">
        {event.actorUsername} · {new Date(event.occurredAt).toLocaleString()}
      </p>
    </li>
  )
}

function PermissionOption({
  permission,
  checked,
  disabled,
  onChange,
}: {
  permission: PermissionResponse
  checked: boolean
  disabled: boolean
  onChange: () => void
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="min-w-0">
          <span className="block font-mono text-xs font-semibold text-navy-900">
            {permission.code}
          </span>
          <span className="mt-0.5 block text-sm text-slate-600">{permission.description}</span>
        </span>
      </label>
    </li>
  )
}
