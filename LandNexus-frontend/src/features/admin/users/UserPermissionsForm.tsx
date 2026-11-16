import { useState } from 'react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import type { UserPermissionEntry, UserPermissions, UserResponse } from '../../../api/types'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Modal } from '../../../components/ui/Modal'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { useApiQuery } from '../../../hooks/useApiQuery'

interface UserPermissionsFormProps {
  user: UserResponse
  load: (id: string) => Promise<UserPermissions>
  save: (id: string, overrides: Array<{ code: string; granted: boolean }>) => Promise<UserPermissions>
  onClose: () => void
  onSaved: () => void
}

export function UserPermissionsForm({ user, load, save, onClose, onSaved }: UserPermissionsFormProps) {
  const dispatch = useAppDispatch()
  const query = useApiQuery(() => load(user.id), [user.id])
  const mutation = useApiMutation<UserPermissions>()
  const [values, setValues] = useState<Record<string, boolean>>({})
  const permissions = query.data?.permissions ?? []

  function valueOf(permission: UserPermissionEntry): boolean {
    return values[permission.code] ?? permission.effective
  }

  async function handleSave() {
    if (!query.data || mutation.isLoading) return
    const overrides = permissions
      .filter((permission) => valueOf(permission) !== permission.roleGranted)
      .map((permission) => ({ code: permission.code, granted: valueOf(permission) }))
    try {
      await mutation.mutate(() => save(user.id, overrides))
      dispatch(addToast({ variant: 'success', message: `Permissions updated for ${user.username}.` }))
      onSaved()
    } catch {
      // The mutation hook keeps the error; the dialog stays open.
    }
  }

  return (
    <Modal
      title={`Module permissions · ${user.username}`}
      description="Each setting overrides the user's role-derived permission. Changes revoke refresh tokens; existing access tokens expire normally."
      size="lg"
      onClose={() => {
        if (!mutation.isLoading) onClose()
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>Cancel</Button>
          <Button onClick={() => void handleSave()} isLoading={mutation.isLoading} disabled={!query.data}>Save permissions</Button>
        </>
      }
    >
      {mutation.error ? <Alert variant="error" title="Permissions were not saved" className="mb-4">{mutation.error.message}</Alert> : null}
      {query.error ? <ErrorState title="Could not load permissions" message={query.error.message} onRetry={query.reload} /> : null}
      {query.isLoading && !query.data ? <div aria-busy="true"><Skeleton className="h-10 w-full" /><Skeleton className="mt-2 h-10 w-full" /></div> : null}
      {query.data ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-3">Permission</th><th className="py-2 pr-3">Role default</th><th className="py-2">Effective</th></tr></thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.code} className="border-b border-slate-100">
                  <td className="py-2 pr-3"><span className="font-mono text-xs">{permission.code}</span><span className="block text-xs text-slate-500">{permission.description}</span></td>
                  <td className="py-2 pr-3">{permission.roleGranted ? 'Granted' : 'Not granted'}</td>
                  <td className="py-2"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={valueOf(permission)} disabled={mutation.isLoading} onChange={(event) => setValues((current) => ({ ...current, [permission.code]: event.target.checked }))} /><span>{valueOf(permission) ? 'Allowed' : 'Denied'}</span></label></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  )
}
