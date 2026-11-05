import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { BrandLockup } from '../../components/brand/BrandLockup'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { consumeSessionNotice } from '../../api/client'
import { clearAuthError, login } from './authSlice'
import { useAuth } from './useAuth'

function safeRedirect(value: unknown): string {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return '/'
}

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const authStatus = useAppSelector((state) => state.auth.status)
  const authError = useAppSelector((state) => state.auth.error)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const message = consumeSessionNotice()
    if (message) {
      setNotice(message)
    }
  }, [])

  const state = location.state as { from?: unknown } | null
  const redirectTo = safeRedirect(state?.from)

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  const isSubmitting = authStatus === 'loading'
  const banner = notice ?? authError

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    try {
      await dispatch(login({ username: username.trim(), password })).unwrap()
      navigate(redirectTo, { replace: true })
    } catch {
      // The slice already stored a safe message for the form.
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-navy-900 px-10 py-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-52 -left-24 h-[30rem] w-[30rem] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />

        <div className="relative flex flex-1 items-center justify-center">
          <div className="flex max-w-lg flex-col items-center text-center">
            <BrandLockup
              tone="on-dark"
              orientation="stacked"
              size="lg"
              centered
              className="items-center"
            />
            <span aria-hidden="true" className="mt-9 h-px w-20 bg-white/25" />
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLockup tone="on-light" orientation="horizontal" size="md" />
          </div>

          <Card className="border-slate-200 p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">
              Sign in to your workspace
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Use the username and password issued by your administrator.
            </p>

            {banner ? (
              <Alert variant="error" className="mt-5">
                {banner}
              </Alert>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <Input
                label="Username"
                name="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  if (authError) {
                    dispatch(clearAuthError())
                  }
                }}
                autoComplete="username"
                autoFocus
                required
                placeholder="Enter your username"
              />

              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (authError) {
                    dispatch(clearAuthError())
                  }
                }}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                }
              />

              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot-password" className="font-medium text-blue-700 hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isSubmitting}
                disabled={!username.trim() || !password}
              >
                {isSubmitting ? 'Signing in…' : 'Sign in securely'}
              </Button>
            </form>
          </Card>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            Access is limited to authorised users. Contact your administrator if you cannot
            sign in.
          </p>
        </div>
      </section>
    </div>
  )
}
