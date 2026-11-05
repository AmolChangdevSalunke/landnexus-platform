import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Card } from '../../components/ui/Card'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-center py-10">
      <Card className="w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <FileQuestion aria-hidden="true" className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">404</p>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">Page not found</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          The page you requested does not exist or may have been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to My work
        </Link>
      </Card>
    </div>
  )
}
