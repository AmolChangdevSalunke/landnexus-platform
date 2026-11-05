import { useId, useState, type FormEvent } from 'react'
import { useAppDispatch } from '../../../app/hooks'
import { addToast } from '../../../app/toastsSlice'
import { createUser } from '../../../api/admin'
import { getFieldError } from '../../../api/errors'
import type { RoleResponse, UserResponse } from '../../../api/types'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { useApiMutation } from '../../../hooks/useApiMutation'
import { RolePicker } from './RolePicker'
import {
  EMAIL_MAX_LENGTH,
  emptyUserForm,
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  toUserCreateRequest,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUserForm,
  type UserFormErrors,
  type UserFormValues,
} from './userForm'

interface UserCreateFormProps {
  roles: RoleResponse[]
  allowSuperAdmin: boolean
  onClose: () => void
  onSaved: (user: UserResponse) => void
}

export function UserCreateForm({
  roles,
  allowSuperAdmin,
  onClose,
  onSaved,
}: UserCreateFormProps) {
  const dispatch = useAppDispatch()
  const formId = useId()
  const mutation = useApiMutation<UserResponse>()
  const [values, setValues] = useState<UserFormValues>(emptyUserForm)
  const [clientErrors, setClientErrors] = useState<UserFormErrors>({})

  const serverError = mutation.error
  const noRoles = roles.length === 0
  const showTopError =
    serverError !== null &&
    (serverError.fieldErrors.length === 0 || serverError.status !== 400)

  function updateValue<K extends keyof UserFormValues>(
    key: K,
    value: UserFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
    setClientErrors((current) => ({ ...current, [key]: undefined }))
    if (serverError) {
      mutation.reset()
    }
  }

  function fieldError(field: keyof UserFormValues): string | undefined {
    return (
      (serverError ? getFieldError(serverError, field) : undefined) ??
      clientErrors[field]
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading || noRoles) {
      return
    }

    const nextErrors = validateUserForm(values)
    setClientErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => {
        document
          .getElementById(formId)
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus()
      }, 0)
      return
    }

    try {
      const created = await mutation.mutate(() => createUser(toUserCreateRequest(values)))
      dispatch(
        addToast({
          variant: 'success',
          message: `User ${created.username} created.`,
        }),
      )
      onSaved(created)
    } catch {
      // The mutation hook keeps the error; the form stays filled in.
    }
  }

  return (
    <Modal
      title="New user"
      description="The account is active immediately. Share the password through a secure channel; it is never shown again."
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
          <Button
            type="submit"
            form={formId}
            isLoading={mutation.isLoading}
            disabled={noRoles}
          >
            Create user
          </Button>
        </>
      }
    >
      {noRoles ? (
        <Alert variant="warning" title="Roles unavailable" className="mb-4">
          An account needs at least one role. The role list could not be loaded, so a user
          cannot be created right now.
        </Alert>
      ) : null}

      {showTopError && serverError ? (
        <Alert variant="error" title="The user was not created" className="mb-4">
          {serverError.message}
        </Alert>
      ) : null}

      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            required
            autoComplete="name"
            value={values.fullName}
            onChange={(event) => updateValue('fullName', event.target.value)}
            maxLength={FULL_NAME_MAX_LENGTH}
            error={fieldError('fullName')}
            hint={`${values.fullName.length}/${FULL_NAME_MAX_LENGTH} characters`}
          />
          <Input
            label="Username"
            required
            autoComplete="username"
            value={values.username}
            onChange={(event) => updateValue('username', event.target.value)}
            maxLength={USERNAME_MAX_LENGTH}
            error={fieldError('username')}
            hint={`${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters: letters, digits, dot, underscore or hyphen.`}
          />
        </div>

        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={values.email}
          onChange={(event) => updateValue('email', event.target.value)}
          maxLength={EMAIL_MAX_LENGTH}
          error={fieldError('email')}
          hint="Stored in lower case. Used for sign-in recovery."
        />

        <Input
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => updateValue('password', event.target.value)}
          maxLength={PASSWORD_MAX_LENGTH}
          error={fieldError('password')}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters with one letter and one digit; at most ${PASSWORD_MAX_BYTES} UTF-8 bytes.`}
        />

        <RolePicker
          roles={roles}
          selected={values.roles}
          onChange={(next) => updateValue('roles', next)}
          allowSuperAdmin={allowSuperAdmin}
          error={fieldError('roles')}
          disabled={mutation.isLoading}
        />
      </form>
    </Modal>
  )
}
