import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, RotateCcw, Settings2 } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import {
  createRoutingRule,
  getRoutingRules,
  setRoutingRuleActive,
  updateRoutingRule,
} from '../../api/projects'
import type {
  RoutingDecisionLevel,
  RoutingProjectType,
  RoutingRuleRequest,
  RoutingRuleResponse,
} from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ErrorState } from '../../components/ui/ErrorState'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'

const PROJECT_TYPES: RoutingProjectType[] = [
  'NATIONAL_HIGHWAY',
  'STATE_HIGHWAY',
  'DISTRICT_ROAD',
  'RURAL_ROAD',
  'EXPRESSWAY',
  'RAILWAY',
  'DAM',
  'IRRIGATION',
  'SCHOOL',
  'HOSPITAL',
  'GOVERNMENT_BUILDING',
  'OTHER_INFRASTRUCTURE',
]
const DECISION_LEVELS: RoutingDecisionLevel[] = ['DISTRICT', 'STATE', 'CENTRAL']

interface RuleForm {
  name: string
  minAreaHa: string
  maxAreaHa: string
  projectType: string
  decisionLevel: RoutingDecisionLevel
  note: string
}

const EMPTY_FORM: RuleForm = {
  name: '',
  minAreaHa: '',
  maxAreaHa: '',
  projectType: '',
  decisionLevel: 'DISTRICT',
  note: '',
}

type Confirmation =
  | { kind: 'save' }
  | { kind: 'active'; rule: RoutingRuleResponse }
  | null

export function RoutingRulesPage() {
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const canManage = can(PERMISSION.ROUTING_RULE_MANAGE)
  const canReadSla = can(PERMISSION.SLA_READ)
  const query = useApiQuery(() => getRoutingRules(), [])
  const mutation = useApiMutation<RoutingRuleResponse>()
  const rules = query.data ?? []
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RoutingRuleResponse | null>(null)
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)

  function openCreate() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    mutation.reset()
    setFormOpen(true)
  }

  function openEdit(rule: RoutingRuleResponse) {
    setEditTarget(rule)
    setForm({
      name: rule.name,
      minAreaHa: rule.minAreaHa?.toString() ?? '',
      maxAreaHa: rule.maxAreaHa?.toString() ?? '',
      projectType: rule.projectType ?? '',
      decisionLevel: rule.decisionLevel,
      note: rule.note ?? '',
    })
    setFormError(null)
    mutation.reset()
    setFormOpen(true)
  }

  function closeForm() {
    if (!mutation.isLoading) {
      setFormOpen(false)
      setConfirmation(null)
    }
  }

  function toRequest(): RoutingRuleRequest | null {
    const min = form.minAreaHa.trim() ? Number(form.minAreaHa) : null
    const max = form.maxAreaHa.trim() ? Number(form.maxAreaHa) : null
    if (!form.name.trim()) {
      setFormError('Enter a rule name.')
      return null
    }
    if ((min !== null && (!Number.isFinite(min) || min < 0)) ||
        (max !== null && (!Number.isFinite(max) || max < 0))) {
      setFormError('Area thresholds must be valid non-negative numbers.')
      return null
    }
    if (min !== null && max !== null && max <= min) {
      setFormError('Maximum area must be greater than minimum area.')
      return null
    }
    return {
      name: form.name.trim(),
      minAreaHa: min,
      maxAreaHa: max,
      projectType: form.projectType ? form.projectType as RoutingProjectType : null,
      decisionLevel: form.decisionLevel,
      note: form.note.trim() || null,
    }
  }

  async function saveRule() {
    const request = toRequest()
    if (!request) {
      setConfirmation(null)
      return
    }
    try {
      const saved = editTarget
        ? await mutation.mutate(() => updateRoutingRule(editTarget.id, request))
        : await mutation.mutate(() => createRoutingRule(request))
      dispatch(
        addToast({
          variant: 'success',
          message: `Routing rule ${saved.name} ${editTarget ? 'updated' : 'created'}.`,
        }),
      )
      setFormOpen(false)
      setConfirmation(null)
      query.reload()
    } catch {
      setConfirmation(null)
    }
  }

  async function toggleActive(rule: RoutingRuleResponse) {
    try {
      const saved = await mutation.mutate(() => setRoutingRuleActive(rule.id, !rule.active))
      dispatch(
        addToast({
          variant: 'success',
          message: `${saved.name} ${saved.active ? 'activated' : 'deactivated'}.`,
        }),
      )
      setConfirmation(null)
      query.reload()
    } catch {
      setConfirmation(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration · Workflow automation"
        title="Workflow routing rules"
        description="Configure the area and project-type criteria that select the decision authority for proposals."
        actions={
          <>
            {canReadSla ? (
              <Link
                to="/monitoring/sla"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Settings2 aria-hidden="true" className="h-4 w-4" />
                SLA settings
              </Link>
            ) : null}
            {canManage ? (
              <Button onClick={openCreate} leftIcon={<PlusCircle aria-hidden="true" className="h-4 w-4" />}>
                Add routing rule
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={query.reload}
              disabled={query.isLoading}
              leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      <Alert variant="warning" title="Routing is configuration, not legal authority" className="mb-4">
        Seeded 100-hectare bands are illustrative DEMO rules, not government policy. Routing chooses
        an eligible officer by role, geographic scope, and workload; rule changes do not replace
        required human scrutiny or approval. Every change is audited by the backend.
      </Alert>

      {mutation.error && !formOpen ? (
        <Alert variant="error" title="The routing rule change was not completed" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <Card className="p-4">
        <CardHeader
          title="Decision routing catalogue"
          description="Specific project-type rules take precedence over general rules; the backend applies the configured matching logic."
          action={<Badge variant={canManage ? 'success' : 'neutral'}>{canManage ? 'Manage enabled' : 'Read only'}</Badge>}
        />
        {query.error ? (
          <div className="mt-4">
            <ErrorState
              title={query.error.status === 403 ? 'You do not have access' : 'Could not load routing rules'}
              message={query.error.message}
              onRetry={query.reload}
            />
          </div>
        ) : query.isLoading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rules.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
            No routing rules are configured. The backend currently falls back to STATE-level decision routing.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Workflow routing rules</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-3">Rule</th>
                  <th scope="col" className="px-3 py-3">Area range (ha)</th>
                  <th scope="col" className="px-3 py-3">Project type</th>
                  <th scope="col" className="px-3 py-3">Decision level</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  {canManage ? <th scope="col" className="px-3 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-navy-900">{rule.name}</p>
                      {rule.note ? <p className="mt-1 max-w-md text-xs text-slate-500">{rule.note}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {rule.minAreaHa ?? '0'} – {rule.maxAreaHa ?? 'No upper limit'}
                    </td>
                    <td className="px-3 py-3">{rule.projectType ?? 'All project types'}</td>
                    <td className="px-3 py-3">{rule.decisionLevel}</td>
                    <td className="px-3 py-3">
                      <Badge variant={rule.active ? 'success' : 'neutral'}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={rule.active ? 'outline' : 'secondary'}
                            onClick={() => {
                              mutation.reset()
                              setConfirmation({ kind: 'active', rule })
                            }}
                          >
                            {rule.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {formOpen ? (
        <Modal
          title={editTarget ? 'Edit routing rule' : 'Create routing rule'}
          description="Area ranges are measured in hectares. Leave a bound empty for an unbounded side."
          onClose={closeForm}
          footer={
            <>
              <Button variant="outline" onClick={closeForm} disabled={mutation.isLoading}>Cancel</Button>
              <Button onClick={() => {
                if (toRequest()) {
                  setConfirmation({ kind: 'save' })
                }
              }}>
                Review changes
              </Button>
            </>
          }
        >
          {formError ? <Alert variant="error" title="Check the rule fields" className="mb-4">{formError}</Alert> : null}
          {mutation.error ? <Alert variant="error" title="Rule was not saved" className="mb-4">{mutation.error.message}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Rule name
              <input
                maxLength={100}
                value={form.name}
                onChange={(event) => {
                  setForm({ ...form, name: event.target.value })
                  setFormError(null)
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal"
                required
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Minimum area (ha)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minAreaHa}
                onChange={(event) => setForm({ ...form, minAreaHa: event.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Maximum area (ha)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maxAreaHa}
                onChange={(event) => setForm({ ...form, maxAreaHa: event.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal"
              />
            </label>
            <Select
              label="Project type"
              value={form.projectType}
              onChange={(event) => setForm({ ...form, projectType: event.target.value })}
            >
              <option value="">All project types</option>
              {PROJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
            <Select
              label="Decision authority level"
              value={form.decisionLevel}
              onChange={(event) => setForm({ ...form, decisionLevel: event.target.value as RoutingDecisionLevel })}
            >
              {DECISION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
            </Select>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Administrative note
              <textarea
                maxLength={300}
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {confirmation?.kind === 'save' ? (
        <ConfirmDialog
          title="Apply routing rule changes?"
          confirmLabel={editTarget ? 'Update rule' : 'Create rule'}
          isLoading={mutation.isLoading}
          onClose={() => setConfirmation(null)}
          onConfirm={() => void saveRule()}
          message="This configuration affects future proposal routing. Existing assignments and approval decisions are not changed."
        />
      ) : confirmation?.kind === 'active' ? (
        <ConfirmDialog
          title={confirmation.rule.active ? 'Deactivate routing rule?' : 'Activate routing rule?'}
          confirmLabel={confirmation.rule.active ? 'Deactivate rule' : 'Activate rule'}
          variant={confirmation.rule.active ? 'danger' : 'primary'}
          isLoading={mutation.isLoading}
          onClose={() => setConfirmation(null)}
          onConfirm={() => void toggleActive(confirmation.rule)}
          message={
            confirmation.rule.active
              ? 'Future proposals will no longer match this rule. At least one active rule must remain.'
              : 'Future proposals may match this rule according to the configured type and area criteria.'
          }
        />
      ) : null}
    </>
  )
}
