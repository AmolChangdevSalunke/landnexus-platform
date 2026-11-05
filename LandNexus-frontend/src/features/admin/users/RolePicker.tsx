import { useId } from 'react'
import type { RoleResponse } from '../../../api/types'

interface RolePickerProps {
  roles: RoleResponse[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Only a SUPER_ADMIN may grant the SUPER_ADMIN role. */
  allowSuperAdmin: boolean
  error?: string
  disabled?: boolean
}

/**
 * Checkbox list of backend roles. The backend still enforces every rule; this
 * only stops an impossible request before it is sent.
 */
export function RolePicker({
  roles,
  selected,
  onChange,
  allowSuperAdmin,
  error,
  disabled = false,
}: RolePickerProps) {
  const groupId = useId()
  const errorId = `${groupId}-error`

  function toggle(code: string) {
    onChange(
      selected.includes(code)
        ? selected.filter((current) => current !== code)
        : [...selected, code],
    )
  }

  return (
    <fieldset
      className="space-y-2"
      aria-describedby={error ? errorId : undefined}
      disabled={disabled}
    >
      <legend className="text-sm font-medium text-slate-700">Roles *</legend>
      <p className="text-xs text-slate-500">
        Replacing the role set changes every permission the account has after its next sign-in.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => {
          const isSuperAdmin = role.code === 'SUPER_ADMIN'
          const blocked = isSuperAdmin && !allowSuperAdmin
          const checked = selected.includes(role.code)

          return (
            <label
              key={role.id}
              className={
                blocked
                  ? 'flex cursor-not-allowed items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500'
                  : 'flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50'
              }
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={checked}
                disabled={blocked}
                onChange={() => toggle(role.code)}
              />
              <span>
                <span className="font-semibold">{role.code}</span>
                <span className="block text-xs text-slate-500">{role.name}</span>
                {blocked ? (
                  <span className="block text-xs font-medium text-warning-700">
                    Only a super administrator can grant this role.
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
