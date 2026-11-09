import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { addToast } from '../../app/toastsSlice'
import { createCase } from '../../api/acquisition'
import { getProjects } from '../../api/projects'
import type { CaseRequest, CaseResponse, Framework } from '../../api/types'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { LinkButton } from '../../components/ui/LinkButton'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { Textarea } from '../../components/ui/Textarea'
import { useApiMutation } from '../../hooks/useApiMutation'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { shortId } from '../../utils/format'
import { PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'
import { FRAMEWORK_LABELS, FRAMEWORK_SHORT_LABELS } from './labels'

const FRAMEWORKS = Object.keys(FRAMEWORK_LABELS) as Framework[]
const NOTE_LIMIT = 300
const DESCRIPTION_LIMIT = 1_000

interface FormValues {
  projectId: string
  framework: Framework | ''
  frameworkNote: string
  description: string
}

interface FormErrors {
  projectId?: string
  framework?: string
  frameworkNote?: string
  description?: string
}

const EMPTY_FORM: FormValues = {
  projectId: '',
  framework: '',
  frameworkNote: '',
  description: '',
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}

  if (!values.projectId) {
    errors.projectId = 'Select an approved project.'
  }
  if (!values.framework) {
    errors.framework = 'Select the legal framework that applies.'
  }
  if (values.frameworkNote.trim().length > NOTE_LIMIT) {
    errors.frameworkNote = `Use at most ${NOTE_LIMIT} characters.`
  }
  if (values.description.trim().length > DESCRIPTION_LIMIT) {
    errors.description = `Use at most ${DESCRIPTION_LIMIT} characters.`
  }

  return errors
}

export function CaseFormPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { canAny } = useAuth()
  const refs = useReferenceNames()
  const mutation = useApiMutation<CaseResponse>()
  const canReadProjects = canAny(...PROPOSAL_READ_ANY)

  const [values, setValues] = useState<FormValues>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})

  const projectsQuery = useApiQuery(
    () => (canReadProjects ? getProjects({ size: 100 }) : Promise.resolve(null)),
    [canReadProjects],
  )

  const projects = (projectsQuery.data?.content ?? []).filter(
    (project) => project.status === 'ACTIVE',
  )
  const selectedProject = projects.find((project) => project.id === values.projectId)

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isLoading) {
      return
    }

    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !values.framework) {
      return
    }

    const request: CaseRequest = {
      projectId: values.projectId,
      framework: values.framework,
      frameworkNote: values.frameworkNote.trim() || null,
      description: values.description.trim() || null,
    }

    try {
      const created = await mutation.mutate(() => createCase(request))
      dispatch(
        addToast({
          variant: 'success',
          message: `Acquisition case ${created.caseNumber} created.`,
        }),
      )
      navigate(`/acquisition/${created.id}`)
    } catch {
      // The mutation keeps the backend message; the form stays filled in.
    }
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const noProjects =
    canReadProjects && !projectsQuery.error && projects.length === 0

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Land acquisition"
        title="New acquisition case"
        description="A case is always created from an approved government project. The district comes from that project."
        actions={
          <LinkButton to="/acquisition" variant="outline">
            Cancel
          </LinkButton>
        }
      />

      <Alert variant="info" title="Legal framework and state law" className="mb-4">
        The applicable law can differ by state and by the purpose of the acquisition. Choose the
        framework the competent authority has approved for this project. This module records the
        workflow; it does not interpret the law.
      </Alert>

      {!canReadProjects ? (
        <Alert variant="warning" title="Project list is not available" className="mb-4">
          Creating a case needs an approved project, but your role cannot read project data.
          Ask an administrator to grant the required proposal read permission.
        </Alert>
      ) : null}

      {projectsQuery.error ? (
        <Alert variant="error" title="Could not load approved projects" className="mb-4">
          {projectsQuery.error.message}
        </Alert>
      ) : null}

      {noProjects ? (
        <Alert variant="warning" title="No approved projects are available" className="mb-4">
          A project appears here after a recommended proposal is approved. You cannot create an
          acquisition case until then.
        </Alert>
      ) : null}

      {mutation.error && mutation.error.fieldErrors.length === 0 ? (
        <Alert variant="error" title="The case was not created" className="mb-4">
          {mutation.error.message}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Card className="p-5">
          <CardHeader
            title="Case details"
            description="The case number and status are assigned by the backend."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Select
              label="Approved project"
              required
              value={values.projectId}
              onChange={(event) => update('projectId', event.target.value)}
              error={errors.projectId}
              disabled={!canReadProjects || projects.length === 0}
              hint={
                canReadProjects
                  ? 'Only active projects created from approved proposals are listed.'
                  : 'Project data is not available to your role.'
              }
              containerClassName="md:col-span-2"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.title}
                </option>
              ))}
            </Select>

            {selectedProject ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <dl className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      District
                    </dt>
                    <dd className="mt-0.5 text-sm text-slate-800">
                      {refs.districtName(selectedProject.districtId) ??
                        shortId(selectedProject.districtId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      State
                    </dt>
                    <dd className="mt-0.5 text-sm text-slate-800">
                      {refs.stateName(selectedProject.stateId) ?? shortId(selectedProject.stateId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Project villages
                    </dt>
                    <dd className="mt-0.5 text-sm text-slate-800">
                      {selectedProject.villageIds.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Approved
                    </dt>
                    <dd className="mt-0.5 text-sm text-slate-800">
                      {selectedProject.approvedAt
                        ? new Date(selectedProject.approvedAt).toLocaleDateString('en-IN')
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <Select
              label="Legal framework"
              required
              value={values.framework}
              onChange={(event) => update('framework', event.target.value as Framework | '')}
              error={errors.framework}
              hint="The backend does not choose a law for you."
              containerClassName="md:col-span-2"
            >
              <option value="">Select a framework</option>
              {FRAMEWORKS.map((framework) => (
                <option key={framework} value={framework}>
                  {FRAMEWORK_LABELS[framework]}
                </option>
              ))}
            </Select>

            <Input
              label="Framework note (optional)"
              value={values.frameworkNote}
              onChange={(event) => update('frameworkNote', event.target.value)}
              maxLength={NOTE_LIMIT}
              error={errors.frameworkNote}
              hint={`${values.frameworkNote.length}/${NOTE_LIMIT} characters. Use this for the state Act, notification or government order reference.`}
              containerClassName="md:col-span-2"
            />

            <Textarea
              label="Description (optional)"
              value={values.description}
              onChange={(event) => update('description', event.target.value)}
              maxLength={DESCRIPTION_LIMIT}
              error={errors.description}
              hint={`${values.description.length}/${DESCRIPTION_LIMIT} characters.`}
              rows={4}
              containerClassName="md:col-span-2"
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3 text-sm text-slate-600">
            <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <p>
              After the case is created, add the affected villages and parcels. The case starts
              as <strong className="font-semibold text-navy-900">Initiated</strong> and can be
              cancelled only before the award is declared.
            </p>
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-card backdrop-blur">
          <p className="text-xs text-slate-500">
            The selected framework is {values.framework ? FRAMEWORK_SHORT_LABELS[values.framework] : 'not selected yet'}.
          </p>
          <div className="flex gap-2">
            <LinkButton to="/acquisition" variant="outline">
              Cancel
            </LinkButton>
            <Button
              type="submit"
              isLoading={mutation.isLoading}
              disabled={mutation.isLoading || !canReadProjects || projects.length === 0}
            >
              Create case
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
