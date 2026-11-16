import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { resetPasswordRequest } from '../../api/auth'
import { toApiErrorInfo } from '../../api/errors'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'

const MIN_PASSWORD_LENGTH = 12

export function ForgotPasswordPage() {
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await resetPasswordRequest(code.trim(), newPassword)
      setConfirmed(true)
      setCode('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (caught) {
      setError(toApiErrorInfo(caught).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <Card className="w-full max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-700">
            <KeyRound aria-hidden="true" className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Password changed</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your password has been reset and all earlier sessions have been signed out. Sign in
            with your new password.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to sign in
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <Card className="w-full max-w-lg p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <KeyRound aria-hidden="true" className="h-7 w-7" />
        </div>
        <h1 className="text-center text-2xl font-bold text-navy-900">Reset your password</h1>
        <p className="mt-3 text-center text-sm leading-6 text-slate-600">
          Ask your administrator for a one-time reset code. It is valid for 60 minutes and can be
          used once.
        </p>

        {error ? (
          <Alert variant="error" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <Input
            label="Reset code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            required
            autoFocus
            placeholder="Paste the code from your administrator"
          />

          <Input
            label="New password"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
            hint="At least 12 characters, with an uppercase letter, a lowercase letter and a digit."
            placeholder="Enter a new password"
          />

          <Input
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            placeholder="Enter the new password again"
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
            disabled={!code.trim() || !newPassword || !confirmPassword}
          >
            {isSubmitting ? 'Resetting password…' : 'Reset password'}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          Never share your reset code or password with anyone.{' '}
          <Link to="/login" className="font-medium text-blue-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
