import { useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getRoles } from '../../../api/admin'
import type { RoleResponse } from '../../../api/types'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Alert } from '../../../components/ui/Alert'
import { Badge } from '../../../components/ui/Badge'
import { Card, CardHeader } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useApiQuery } from '../../../hooks/useApiQuery'

export function RolesPage() {
  const query = useApiQuery(() => getRoles(), [])
  const roles = query.data ?? []

  const permissionCodes = useMemo(() => {
    const all = new Set<string>()
    for (const role of roles) {
      for (const permission of role.permissions) {
        all.add(permission)
      }
    }
    return [...all].sort((left, right) => left.localeCompare(right))
  }, [roles])

  return (
    <>
      <PageHeader
        eyebrow="Administration · Access control"
        title="Roles and permissions"
        description="The role definitions seeded in the backend. This screen is read-only because the API exposes no role-editing endpoint."
      />

      <Alert variant="info" title="Read-only reference data" className="mb-4">
        A user receives every permission of every role assigned to them. Change access by
        editing a user&apos;s roles on the Users screen; the backend remains the authority.
      </Alert>

      {query.error ? (
        <Card>
          <ErrorState
            title={query.error.status === 403 ? 'You do not have access' : 'Could not load roles'}
            message={query.error.message}
            onRetry={query.reload}
          />
        </Card>
      ) : query.isLoading ? (
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Roles
              </p>
              <p className="mt-1 text-2xl font-bold text-navy-900">{roles.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Distinct permissions
              </p>
              <p className="mt-1 text-2xl font-bold text-navy-900">
                {permissionCodes.length}
              </p>
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
              description="Every role returned by GET /administration/roles, with its permission codes."
              action={<Badge variant="neutral">Read only</Badge>}
            />
            <ul className="mt-4 divide-y divide-slate-100">
              {roles.map((role) => (
                <RoleRow key={role.id} role={role} />
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <CardHeader
                title="Permission matrix"
                description="A filled cell means the role contains that permission code."
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
                        <span className="block text-xs font-normal text-slate-500">
                          {role.name}
                        </span>
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
        </div>
      )}

      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge variant="neutral">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
          No edit controls
        </Badge>
        Role and permission definitions are reference data managed by database migrations.
      </p>
    </>
  )
}

function RoleRow({ role }: { role: RoleResponse }) {
  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-navy-900">
          {role.name} <span className="font-mono text-xs text-slate-500">{role.code}</span>
        </p>
        <p className="mt-0.5 text-sm text-slate-600">{role.description}</p>
      </div>
      <div className="flex max-w-xl flex-wrap gap-1 sm:justify-end">
        {role.permissions.length === 0 ? (
          <span className="text-xs text-slate-400">No permissions</span>
        ) : (
          role.permissions.map((permission) => (
            <Badge key={permission} variant="info">
              {permission}
            </Badge>
          ))
        )}
      </div>
    </li>
  )
}
