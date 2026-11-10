import { useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getRuleSet } from '../../api/compensation'
import type { RuleSetResponse } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card, CardHeader } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { formatDate, shortId } from '../../utils/format'
import {
  COMPONENT_TYPE_LABELS,
  FRAMEWORK_LABELS,
  RULE_SET_STATUS_LABELS,
  RULE_SET_STATUS_VARIANTS,
  ruleSetPlace,
} from './labels'

/**
 * Standalone definition of one rule set, wired to the by-id endpoint. It shows
 * exactly the components the backend returned; no formula is rebuilt here.
 */
export function RuleSetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const refs = useReferenceNames()

  const query = useApiQuery<RuleSetResponse | null>(
    () => (id ? getRuleSet(id) : Promise.resolve(null)),
    [id],
    Boolean(id),
  )

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.error || !query.data) {
    return (
      <>
        <PageHeader
          eyebrow="Module 5 · Compensation"
          title="Rule set definition"
          description="The rule set could not be loaded."
        />
        <Card>
          <ErrorState
            title={
              query.error?.status === 404
                ? 'Rule set not found'
                : query.error?.status === 403
                  ? 'You do not have access to this rule set'
                  : 'Could not load the rule set'
            }
            message={query.error?.message ?? 'It may not exist, or you may not have access.'}
            onRetry={query.reload}
          />
          <div className="flex justify-center pb-6">
            <LinkButton to="/compensation/rules" variant="outline">
              Back to rate cards and rule sets
            </LinkButton>
          </div>
        </Card>
      </>
    )
  }

  const ruleSet = query.data

  return (
    <>
      <PageHeader
        eyebrow="Module 5 · Compensation"
        title="Rule set definition"
        description="The components that turn approved rates into an estimate. The most specific approved set valid on the reference date is used."
        actions={
          <LinkButton
            to="/compensation/rules"
            variant="outline"
            leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
          >
            Back to rate cards and rule sets
          </LinkButton>
        }
      />

      <Card className="p-4">
        <CardHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {ruleSet.name}
              <Badge variant="neutral">v{ruleSet.version}</Badge>
              <Badge variant={RULE_SET_STATUS_VARIANTS[ruleSet.status]}>
                {RULE_SET_STATUS_LABELS[ruleSet.status]}
              </Badge>
            </span>
          }
          description={`${ruleSetPlace(ruleSet)}${ruleSet.stateId ? ` · ${refs.stateName(ruleSet.stateId) ?? `State ${shortId(ruleSet.stateId)}`}` : ''}${ruleSet.districtId ? ` · ${refs.districtName(ruleSet.districtId) ?? `District ${shortId(ruleSet.districtId)}`}` : ''}`}
        />

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Legal framework
            </p>
            <p className="mt-1 text-slate-800">{FRAMEWORK_LABELS[ruleSet.framework]}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Validity
            </p>
            <p className="mt-1 text-slate-800">
              {formatDate(ruleSet.effectiveFrom)} to{' '}
              {ruleSet.effectiveTo ? formatDate(ruleSet.effectiveTo) : 'open ended'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Drafted by user
            </p>
            <p className="mt-1 flex items-center gap-1">
              <span className="font-mono" title={ruleSet.createdByUserId}>
                {shortId(ruleSet.createdByUserId)}
              </span>
              <CopyButton value={ruleSet.id} label="rule set id" />
            </p>
            {ruleSet.approvedAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Approved {formatDate(ruleSet.approvedAt)} by user{' '}
                <span className="font-mono" title={ruleSet.approvedByUserId ?? undefined}>
                  {shortId(ruleSet.approvedByUserId)}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        {ruleSet.description ? (
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {ruleSet.description}
          </p>
        ) : null}

        {ruleSet.retireReason ? (
          <p className="mt-4 rounded bg-warning-50 px-3 py-2 text-xs text-warning-700">
            Retired: {ruleSet.retireReason}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
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
                  <td className="px-3 py-2 text-slate-600">
                    {COMPONENT_TYPE_LABELS[component.type]}
                  </td>
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

        <p className="mt-4 text-xs text-slate-500">
          Drafting, approval and retirement happen on the rate cards and rule sets page. A
          rule set drafted by one officer must be approved by another before it is used.
        </p>
      </Card>
    </>
  )
}
