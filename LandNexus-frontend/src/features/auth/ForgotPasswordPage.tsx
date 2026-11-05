import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { Card } from '../../components/ui/Card'

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <KeyRound aria-hidden="true" className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-navy-900">Password reset is not available yet</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This platform does not have a self-service password reset or change-password API yet.
          Please contact your administrator to reset your password. Never share your password
          with anyone.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to sign in
        </Link>
      </Card>
    </div>
  )
}
