import { useState, type FormEvent } from 'react'
import { PlusCircle } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { createBenefitType, getBenefitTypes } from '../../api/compensation'
import type { BenefitTypeResponse, RrBenefitKind } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { DataTable, type TableColumn } from '../../components/ui/DataTable'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { formatMoney } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { RR_BENEFIT_KIND_LABELS } from './labels'

const KIND_OPTIONS = Object.entries(RR_BENEFIT_KIND_LABELS) as [RrBenefitKind, string][]

export function BenefitCataloguePage() {
  const { can } = useAuth()
  const [formOpen, setFormOpen] = useState(false)
  const query = useApiQuery(() => getBenefitTypes(), [])
  const canManage = can(PERMISSION.RR_CATALOGUE)
  const benefits = query.data ?? []

  const columns: TableColumn<BenefitTypeResponse>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (benefit) => (
        <span className="font-mono text-xs text-slate-700">{benefit.code}</span>
      ),
    },
    { key: 'name', header: 'Benefit', render: (benefit) => benefit.name },
    {
      key: 'kind',
      header: 'Kind',
      render: (benefit) => RR_BENEFIT_KIND_LABELS[benefit.kind],
    },
    {
      key: 'defaultAmount',
      header: 'Default amount',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (benefit) =>
        benefit.defaultAmount === null ? '—' : formatMoney(benefit.defaultAmount),
    },
    {
      key: 'months',
      header: 'Default months',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (benefit) => benefit.defaultMonths ?? '—',
    },
    {
      key: 'conditions',
      header: 'Conditions',
      render: (benefit) => {
        const conditions: string[] = []
        if (benefit.requiresDisplaced) {
          conditions.push('Lost home')
        }
        if (benefit.requiresLivelihoodLost) {
          conditions.push('Lost livelihood')
        }
        return conditions.length > 0 ? (
          <span className="text-xs text-slate-600">{conditions.join(' · ')}</span>
        ) : (
          <span className="text-xs text-slate-500">No extra condition</span>
        )
      },
    },
    {
      key: 'active',
      header: 'Status',
      render: (benefit) => (
        <Badge variant={benefit.active ? 'success' : 'neutral'}>
          {benefit.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Module 5 · Compensation"
        title="R&R benefit catalogue"
        description="The catalogue lists the benefit types an officer may add to a rehabilitation and resettlement case. Conditions are simple facts recorded for the family; no sensitive attribute is stored."
        actions={
          canManage ? (
            <Button
              onClick={() => setFormOpen(true)}
              leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
            >
              New benefit type
            </Button>
          ) : undefined
        }
      />

      <Alert variant="info" className="mb-4">
        Benefit types are defined by the administering authority from the applicable policy. This
        system does not build a legal entitlement into the catalogue.
      </Alert>

      <Card className="p-4">
        <CardHeader
          title="Benefit types"
          description="Only active types can be added to a new R&R case."
        />
        {query.error ? (
          <div className="mt-4">
            <ErrorState
              title="Could not load the benefit catalogue"
              message={query.error.message}
              onRetry={query.reload}
            />
          </div>
        ) : (
          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={benefits}
              rowKey={(benefit) => benefit.id}
              isLoading={query.isLoading}
              caption="R&R benefit types"
              emptyTitle="No benefit types yet"
              emptyDescription={
                canManage
                  ? 'Add the first benefit type from the applicable policy.'
                  : 'The catalogue is empty. An administrator can add benefit types.'
              }
            />
          </div>
        )}
      </Card>

      {formOpen ? (
        <NewBenefitDialog
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            query.reload()
          }}
        />
      ) : null}
    </>
  )
}

function NewBenefitDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<BenefitTypeResponse>()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<RrBenefitKind | ''>('')
  const [defaultAmount, setDefaultAmount] = useState('')
  const [defaultMonths, setDefaultMonths] = useState('')
  const [requiresDisplaced, setRequiresDisplaced] = useState(false)
  const [requiresLivelihoodLost, setRequiresLivelihoodLost] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: Record<string, string> = {}
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code.trim())) {
      nextErrors.code =
        'Use capital letters, digits and underscores, starting with a letter (2–40 characters).'
    }
    if (!name.trim()) {
      nextErrors.name = 'Enter a name.'
    }
    if (!kind) {
      nextErrors.kind = 'Select the benefit kind.'
    }
    if (defaultAmount.trim()) {
      const amount = Number(defaultAmount)
      if (!Number.isFinite(amount) || amount < 0) {
        nextErrors.defaultAmount = 'Enter an amount of zero or more.'
      }
    }
    if (defaultMonths.trim()) {
      const months = Number(defaultMonths)
      if (!Number.isInteger(months) || months < 1 || months > 120) {
        nextErrors.defaultMonths = 'Enter a whole number of months between 1 and 120.'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        createBenefitType({
          code: code.trim(),
          name: name.trim(),
          kind: kind as RrBenefitKind,
          defaultAmount: defaultAmount.trim() ? Number(defaultAmount) : null,
          defaultMonths: defaultMonths.trim() ? Number(defaultMonths) : null,
          requiresDisplaced,
          requiresLivelihoodLost,
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Benefit type added.' }))
      onSaved()
    } catch {
      // The mutation keeps the backend message.
    }
  }

  return (
    <Modal
      title="New benefit type"
      description="Describe a benefit from the applicable policy. No sensitive attribute is collected."
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="new-benefit-form" isLoading={mutation.isLoading}>
            Save benefit type
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The benefit type was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="new-benefit-form" onSubmit={submit} noValidate className="space-y-4">
        <Input
          label="Code"
          required
          value={code}
          maxLength={40}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          error={errors.code}
          hint="For example HOUSING_UNIT."
        />
        <Input
          label="Name"
          required
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <Select
          label="Kind"
          required
          value={kind}
          onChange={(event) => setKind(event.target.value as RrBenefitKind)}
          error={errors.kind}
        >
          <option value="">Select a kind</option>
          {KIND_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Default amount (INR, optional)"
            inputMode="decimal"
            value={defaultAmount}
            onChange={(event) => setDefaultAmount(event.target.value)}
            error={errors.defaultAmount}
            hint="Leave blank when the amount is decided per family."
          />
          <Input
            label="Default months (optional)"
            inputMode="numeric"
            value={defaultMonths}
            onChange={(event) => setDefaultMonths(event.target.value)}
            error={errors.defaultMonths}
          />
        </div>

        <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Conditions
          </legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={requiresDisplaced}
              onChange={(event) => setRequiresDisplaced(event.target.checked)}
            />
            Only for a family that lost their home
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={requiresLivelihoodLost}
              onChange={(event) => setRequiresLivelihoodLost(event.target.checked)}
            />
            Only for a family that lost their livelihood
          </label>
        </fieldset>
      </form>
    </Modal>
  )
}
