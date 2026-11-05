import { useNavigate } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

export function NoAccessPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-2xl items-center justify-center py-10">
      <Card className="w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
          <ShieldX aria-hidden="true" className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-danger-600">403</p>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">No access</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Your account does not have permission to open this page. If you believe this is a
          mistake, contact your administrator.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => navigate('/')}>
          Back to My work
        </Button>
      </Card>
    </div>
  )
}
