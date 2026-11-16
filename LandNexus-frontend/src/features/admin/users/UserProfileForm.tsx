import { useId, useState, type FormEvent } from 'react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import { getFieldError } from '../../../api/errors'
import { updateUserProfile } from '../../../api/admin'
import type { UserResponse } from '../../../api/types'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { useApiMutation } from '../../../hooks/useApiMutation'

interface UserProfileFormProps {
  user: UserResponse
  onClose: () => void
  onSaved: (user: UserResponse) => void
}

export function UserProfileForm({ user, onClose, onSaved }: UserProfileFormProps) {
  const dispatch = useAppDispatch()
  const formId = useId()
  const mutation = useApiMutation<UserResponse>()
  const [email, setEmail] = useState(user.email)
  const [fullName, setFullName] = useState(user.fullName)
  const [clientError, setClientError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) return
    const normalizedEmail = email.trim()
    const normalizedName = fullName.trim()
    if (
      !normalizedEmail ||
      normalizedEmail.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setClientError('Enter a valid email address (maximum 150 characters).')
      return
    }
    if (!normalizedName || normalizedName.length > 150) {
      setClientError('Enter a full name (maximum 150 characters).')
      return
    }
    setClientError(null)
    try {
      const saved = await mutation.mutate(() =>
        updateUserProfile(user.id, { email: normalizedEmail, fullName: normalizedName }),
      )
      dispatch(addToast({ variant: 'success', message: `${saved.username} profile updated.` }))
      onSaved(saved)
    } catch {
      // The mutation hook exposes the server error in the form.
    }
  }

  const serverError = mutation.error

  return (
    <Modal
      title={`Edit ${user.username}`}
      description="Update the account's contact email and display name. Login name, roles and geographic scope are managed separately."
      onClose={() => {
        if (!mutation.isLoading) onClose()
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>Cancel</Button>
          <Button type="submit" form={formId} isLoading={mutation.isLoading}>Save profile</Button>
        </>
      }
    >
      {serverError && serverError.fieldErrors.length === 0 ? (
        <Alert variant="error" title="Profile was not updated" className="mb-4">
          {serverError.message}
        </Alert>
      ) : null}
      {clientError ? <Alert variant="error" className="mb-4">{clientError}</Alert> : null}
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Full name"
          required
          maxLength={150}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={serverError ? getFieldError(serverError, 'fullName') : undefined}
        />
        <Input
          label="Email"
          type="email"
          required
          maxLength={150}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={serverError ? getFieldError(serverError, 'email') : undefined}
        />
      </form>
    </Modal>
  )
}
