import type { UserCreateRequest } from '../../../api/types'

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 60
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/
export const FULL_NAME_MAX_LENGTH = 150
export const EMAIL_MAX_LENGTH = 150
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
export const PASSWORD_MAX_BYTES = 72
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface UserFormValues {
  username: string
  fullName: string
  email: string
  password: string
  roles: string[]
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>

export function emptyUserForm(): UserFormValues {
  return {
    username: '',
    fullName: '',
    email: '',
    password: '',
    roles: [],
  }
}

/** UTF-8 byte length without relying on browser-only helpers. */
export function utf8ByteLength(value: string): number {
  let bytes = 0
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x7f) {
      bytes += 1
    } else if (code <= 0x7ff) {
      bytes += 2
    } else if (code <= 0xffff) {
      bytes += 3
    } else {
      bytes += 4
    }
  }
  return bytes
}

/** Mirrors UserCreateRequest and PasswordPolicy on the backend. */
export function validateUserForm(values: UserFormValues): UserFormErrors {
  const errors: UserFormErrors = {}
  const username = values.username.trim()
  const fullName = values.fullName.trim()
  const email = values.email.trim()

  if (!username) {
    errors.username = 'Username is required.'
  } else if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    errors.username = `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username = 'Use only letters, digits, dot, underscore and hyphen.'
  }

  if (!fullName) {
    errors.fullName = 'Full name is required.'
  } else if (fullName.length > FULL_NAME_MAX_LENGTH) {
    errors.fullName = `Full name must be at most ${FULL_NAME_MAX_LENGTH} characters.`
  }

  if (!email) {
    errors.email = 'Email is required.'
  } else if (email.length > EMAIL_MAX_LENGTH) {
    errors.email = `Email must be at most ${EMAIL_MAX_LENGTH} characters.`
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.password) {
    errors.password = 'Password is required.'
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters long.`
  } else if (utf8ByteLength(values.password) > PASSWORD_MAX_BYTES) {
    errors.password = `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes).`
  } else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = 'Password must contain at least one letter and one digit.'
  }

  if (values.roles.length === 0) {
    errors.roles = 'Select at least one role.'
  }

  return errors
}

export function toUserCreateRequest(values: UserFormValues): UserCreateRequest {
  return {
    username: values.username.trim(),
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    password: values.password,
    roles: [...values.roles],
  }
}
