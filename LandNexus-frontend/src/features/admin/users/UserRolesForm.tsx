import { useState } from 'react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import { updateUserRoles } from '../../../api/admin'
import type { RoleResponse, UserResponse } from '../../../api/types'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { RolePicker } from './RolePicker'

interface UserRolesFormProps {
  user: UserResponse
  roles: RoleResponse[]
  allowSuperAdmin: boolean
  onClose: () => void
  onSaved: (user: UserResponse) => void
}

export function UserRolesForm({
  user,
  roles,
  allowSuperAdmin,
  onClose,
  onSaved,
}: UserRolesFormProps) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<UserResponse>()
  const [selected, setSelected] = useState<string[]>(user.roles)
  const [clientError, setClientError] = useState<string | undefined>(undefined)

  async function handleSave() {
    if (mutation.isLoading) {
      return
    }
    if (selected.length === 0) {
      setClientError('Select at least one role.')
      return
    }

    try {
      const saved = await mutation.mutate(() => updateUserRoles(user.id, selected))
      dispatch(
        addToast({
          variant: 'success',
          message: `Roles updated for ${saved.username}.`,
        }),
      )
      onSaved(saved)
    } catch {
      // The mutation hook keeps the error; the dialog stays open.
    }
  }

  return (
    <Modal
      title={`Edit roles · ${user.username}`}
      description="The new role set replaces the old one. The backend rejects any role the caller may not grant."
      onClose={() => {
        if (!mutation.isLoading) {
          onClose()
        }
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} isLoading={mutation.isLoading}>
            Save roles
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="Roles were not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <RolePicker
        roles={roles}
        selected={selected}
        onChange={(next) => {
          setSelected(next)
          setClientError(undefined)
        }}
        allowSuperAdmin={allowSuperAdmin}
        error={clientError}
        disabled={mutation.isLoading}
      />
    </Modal>
  )
}
