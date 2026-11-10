import { useState, type FormEvent } from 'react'
import { Check, PlusCircle, RotateCcw } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  approveRuleSet,
  createRuleSet,
  getRuleSets,
  retireRuleSet,
} from '../../api/compensation'
import type {
  ComponentRequest,
  Framework,
  RuleSetResponse,
  RuleSetStatus,
} from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { usePagination } from '../../hooks/usePagination'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate } from '../../utils/format'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { todayIso } from '../acquisition/dates'
import {
  ComponentBuilder,
  draftsToRequests,
  EMPTY_COMPONENT,
  validateComponentDrafts,
  type ComponentDraft,
} from './ComponentBuilder'
import {
  FRAMEWORK_SHORT_LABELS,
  RULE_SET_STATUS_LABELS,
  RULE_SET_STATUS_VARIANTS,
  ruleSetPlace,
} from './labels'
import { RemarksDialog } from './RemarksDialog'

const FRAMEWORK_OPTIONS = Object.entries(FRAMEWORK_SHORT_LABELS) as [Framework, string][]

export function RuleSetsTab() {
  const { can, user } = useAuth()
  const refs = useReferenceNames()
  const pagination = usePagination()
  const [status, setStatus] = useState<RuleSetStatus | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [decision, setDecision] = useState<{
    ruleSet: RuleSetResponse
    action: 'approve' | 'retire'
  } | null>(null)

  const query = useApiQuery(
    () =>
      getRuleSets({
        status: status || undefined,
        page: pagination.page,
        size: pagination.size,
      }),
    [status, pagination.page, pagination.size],
  )

  const canManage = can(PERMISSION.RULESET_MANAGE)
  const canApprove = can(PERMISSION.RULESET_APPROVE)
  const ruleSets = query.data?.content ?? []

  return (
    <div className="space-y-4">
      <Alert variant="warning" title="Rule sets define how compensation is calculated">
        Enter only values taken from the applicable law or notification. Nothing is pre-filled and
        no formula is built into the system. A rule set drafted by one officer must be approved by
        another.
      </Alert>

      <Card className="p-4">
        <CardHeader
          title="Rule sets"
          description="The most specific approved set (district, then state, then nationwide) that is valid on the reference date is used."
          action={
            canManage ? (
              <Button
                onClick={() => setFormOpen(true)}
                leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}
              >
                New rule set
              </Button>
            ) : null
          }
        />

        <div className="mt-4 max-w-xs">
          <Select
            label="Status filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RuleSetStatus | '')
              pagination.reset()
            }}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="RETIRED">Retired</option>
          </Select>
        </div>

        {query.error ? (
          <div className="mt-4">
            <ErrorState
              title="Could not load rule sets"
              message={query.error.message}
              onRetry={query.reload}
            />
          </div>
        ) : query.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading rule sets…</p>
        ) : ruleSets.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-navy-900">No rule sets yet</p>
            <p className="mt-1 text-sm text-slate-500">
              {canManage
                ? 'Draft the first rule set from the applicable law or notification.'
                : 'Rule sets appear here once an officer drafts them.'}
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {ruleSets.map((ruleSet) => {
              const isMaker = ruleSet.createdByUserId === user?.id
              return (
                <li
                  key={ruleSet.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-navy-900">
                          {ruleSet.name}
                        </h3>
                        <Badge variant="neutral">v{ruleSet.version}</Badge>
                        <Badge variant={RULE_SET_STATUS_VARIANTS[ruleSet.status]}>
                          {RULE_SET_STATUS_LABELS[ruleSet.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {FRAMEWORK_SHORT_LABELS[ruleSet.framework]} ·{' '}
                        {ruleSetPlace(ruleSet)}
                        {ruleSet.stateId
                          ? ` · ${refs.stateName(ruleSet.stateId) ?? 'State'}`
                          : ''}
                        {ruleSet.districtId
                          ? ` · ${refs.districtName(ruleSet.districtId) ?? 'District'}`
                          : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Valid {formatDate(ruleSet.effectiveFrom)} to{' '}
                        {ruleSet.effectiveTo ? formatDate(ruleSet.effectiveTo) : 'open ended'}
                        {ruleSet.approvedAt
                          ? ` · approved ${formatDate(ruleSet.approvedAt)}`
                          : ''}
                      </p>
                      {ruleSet.description ? (
                        <p className="mt-2 text-sm text-slate-600">{ruleSet.description}</p>
                      ) : null}
                      {ruleSet.retireReason ? (
                        <p className="mt-2 rounded bg-warning-50 px-2 py-1 text-xs text-warning-700">
                          Retired: {ruleSet.retireReason}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <LinkButton
                        to={`/compensation/rule-sets/${ruleSet.id}`}
                        variant="ghost"
                        size="sm"
                      >
                        View full definition
                      </LinkButton>
                      {ruleSet.status === 'DRAFT' && canApprove ? (
                        isMaker ? (
                          <span className="text-xs text-slate-500" title="Maker-checker rule">
                            You drafted this rule set
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDecision({ ruleSet, action: 'approve' })
                            }
                            leftIcon={<Check aria-hidden="true" className="h-3.5 w-3.5" />}
                          >
                            Approve
                          </Button>
                        )
                      ) : null}
                      {ruleSet.status !== 'RETIRED' && canManage ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDecision({ ruleSet, action: 'retire' })}
                          leftIcon={<RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />}
                        >
                          Retire
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <caption className="sr-only">
                        Components of {ruleSet.name} version {ruleSet.version}
                      </caption>
                      <thead className="bg-slate-50">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            #
                          </th>
                          <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Code
                          </th>
                          <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Name
                          </th>
                          <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Type
                          </th>
                          <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Factor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ruleSet.components.map((component) => (
                          <tr key={component.position}>
                            <td className="px-3 py-2 text-slate-500">{component.position}</td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-700">
                              {component.code}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{component.name}</td>
                            <td className="px-3 py-2 text-slate-600">{component.type}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {component.type === 'ASSET_VALUE' ? '—' : component.factor}
                              {component.baseCodes.length > 0
                                ? ` of ${component.baseCodes.join(', ')}`
                                : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {query.data && query.data.totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {query.data.page + 1} of {query.data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={query.data.page <= 0}
                onClick={() => pagination.setPage(query.data!.page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={query.data.page + 1 >= query.data.totalPages}
                onClick={() => pagination.setPage(query.data!.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {formOpen ? (
        <NewRuleSetDialog
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            query.reload()
          }}
        />
      ) : null}

      {decision ? (
        <RuleSetDecisionDialog
          ruleSet={decision.ruleSet}
          action={decision.action}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null)
            query.reload()
          }}
        />
      ) : null}
    </div>
  )
}

function NewRuleSetDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const refs = useReferenceNames()
  const mutation = useApiMutation<RuleSetResponse>()
  const [name, setName] = useState('')
  const [framework, setFramework] = useState<Framework | ''>('')
  const [stateId, setStateId] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [effectiveTo, setEffectiveTo] = useState('')
  const [description, setDescription] = useState('')
  const [components, setComponents] = useState<ComponentDraft[]>([
    { ...EMPTY_COMPONENT, type: 'LAND_VALUE' },
  ])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [componentErrors, setComponentErrors] = useState<string[]>([])

  const districts = stateId
    ? refs.districts.filter((district) => district.stateId === stateId)
    : refs.districts

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors: Record<string, string> = {}
    if (!name.trim()) {
      nextErrors.name = 'Enter a name.'
    }
    if (!framework) {
      nextErrors.framework = 'Select the legal framework.'
    }
    if (!effectiveFrom) {
      nextErrors.effectiveFrom = 'Choose the start date.'
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      nextErrors.effectiveTo = 'The end date cannot be before the start date.'
    }
    const draftErrors = validateComponentDrafts(components)
    setErrors(nextErrors)
    setComponentErrors(draftErrors)
    if (Object.keys(nextErrors).length > 0 || draftErrors.length > 0) {
      return
    }

    try {
      await mutation.mutate(() =>
        createRuleSet({
          name: name.trim(),
          framework: framework as Framework,
          stateId: stateId || null,
          districtId: districtId || null,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          description: description.trim() || null,
          components: draftsToRequests(components) as ComponentRequest[],
        }),
      )
      dispatch(addToast({ variant: 'success', message: 'Rule set drafted and sent for approval.' }))
      onSaved()
    } catch {
      // The mutation keeps the server's 400 text, which is shown below.
    }
  }

  return (
    <Modal
      title="New rule set"
      description="Enter only the components and values taken from the applicable law or notification. A different officer must approve it."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="new-rule-set-form" isLoading={mutation.isLoading}>
            Save draft
          </Button>
        </>
      }
    >
      {mutation.error ? (
        <Alert variant="error" title="The rule set was not saved" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form id="new-rule-set-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            required
            value={name}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
          <Select
            label="Legal framework"
            required
            value={framework}
            onChange={(event) => setFramework(event.target.value as Framework)}
            error={errors.framework}
          >
            <option value="">Select a framework</option>
            {FRAMEWORK_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="State (optional)"
            value={stateId}
            onChange={(event) => {
              setStateId(event.target.value)
              setDistrictId('')
            }}
            hint="Leave blank for a nationwide rule set."
          >
            <option value="">Nationwide</option>
            {refs.states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </Select>
          <Select
            label="District (optional)"
            value={districtId}
            onChange={(event) => setDistrictId(event.target.value)}
            hint="A district rule set overrides a state or nationwide one."
          >
            <option value="">No specific district</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </Select>
          <Input
            label="Effective from"
            required
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            error={errors.effectiveFrom}
          />
          <Input
            label="Effective to (optional)"
            type="date"
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
            error={errors.effectiveTo}
          />
        </div>

        <Textarea
          label="Description (optional)"
          value={description}
          rows={3}
          maxLength={1000}
          onChange={(event) => setDescription(event.target.value)}
          hint="Quote the notification or section. Do not paste personal data."
        />

        <ComponentBuilder
          value={components}
          onChange={(next) => {
            setComponents(next)
            setComponentErrors([])
          }}
          errors={componentErrors}
        />
      </form>
    </Modal>
  )
}

function RuleSetDecisionDialog({
  ruleSet,
  action,
  onClose,
  onSaved,
}: {
  ruleSet: RuleSetResponse
  action: 'approve' | 'retire'
  onClose: () => void
  onSaved: () => void
}) {
  const dispatch = useAppDispatch()
  const mutation = useApiMutation<RuleSetResponse>()

  async function decide(remarks: string) {
    if (mutation.isLoading) {
      return
    }
    try {
      await mutation.mutate(() =>
        action === 'approve'
          ? approveRuleSet(ruleSet.id)
          : retireRuleSet(ruleSet.id, remarks),
      )
      dispatch(
        addToast({
          variant: 'success',
          message: action === 'approve' ? 'Rule set approved.' : 'Rule set retired.',
        }),
      )
      onSaved()
    } catch {
      // The dialog keeps the backend message.
    }
  }

  return (
    <RemarksDialog
      title={action === 'approve' ? 'Approve this rule set?' : 'Retire this rule set?'}
      description={`${ruleSet.name} v${ruleSet.version} · ${ruleSetPlace(ruleSet)}`}
      confirmLabel={action === 'approve' ? 'Approve rule set' : 'Retire rule set'}
      confirmVariant={action === 'approve' ? 'primary' : 'danger'}
      requireRemarks={action === 'retire'}
      isLoading={mutation.isLoading}
      error={mutation.error}
      onConfirm={(remarks) => void decide(remarks)}
      onClose={onClose}
    />
  )
}
