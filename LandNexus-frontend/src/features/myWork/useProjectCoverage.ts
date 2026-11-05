import type { ApiErrorInfo } from '../../api/errors'
import { getStates } from '../../api/administration'
import { getProjects } from '../../api/projects'
import type { PageResponse } from '../../api/types'
import { useApiQuery } from '../../hooks/useApiQuery'
import { PERMISSION, PROPOSAL_READ_ANY } from '../../utils/permissions'
import { useAuth } from '../auth/useAuth'

interface ProjectCoveragePayload {
  stateNames: string[]
  districtIds: string[]
  projectTotal: number
}

async function readAllPages<T>(
  readPage: (page: number) => Promise<PageResponse<T>>,
): Promise<T[]> {
  const first = await readPage(0)
  const items = [...first.content]

  for (let page = 1; page < first.totalPages; page += 1) {
    items.push(...(await readPage(page)).content)
  }

  return items
}

/**
 * Resolves the real ongoing (ACTIVE) projects into state names and district IDs
 * so the map can colour only the places that actually contain active work.
 * Project state IDs are resolved through the administration state master,
 * never guessed.
 */
async function loadCoverage(): Promise<ProjectCoveragePayload> {
  const [states, firstProjects] = await Promise.all([
    readAllPages((page) => getStates(page, 100)),
    getProjects({ page: 0, size: 100 }),
  ])

  const projects = [...firstProjects.content]
  for (let page = 1; page < firstProjects.totalPages; page += 1) {
    projects.push(...(await getProjects({ page, size: 100 })).content)
  }

  const ongoing = projects.filter((project) => project.status === 'ACTIVE')
  const stateById = new Map(states.map((state) => [state.id, state.name]))
  const stateNames = [
    ...new Set(
      ongoing
        .map((project) => stateById.get(project.stateId))
        .filter((name): name is string => Boolean(name)),
    ),
  ]
  const districtIds = [...new Set(ongoing.map((project) => project.districtId))]

  return { stateNames, districtIds, projectTotal: ongoing.length }
}

export interface ProjectCoverageResult {
  stateNames: string[]
  districtIds: string[]
  projectTotal: number | null
  enabled: boolean
  isLoading: boolean
  error: ApiErrorInfo | null
}

export function useProjectCoverage(): ProjectCoverageResult {
  const { can, canAny } = useAuth()
  const enabled = canAny(...PROPOSAL_READ_ANY) && can(PERMISSION.MASTER_DATA_READ)
  const { data, isLoading, error } = useApiQuery(() => loadCoverage(), [enabled], enabled)

  return {
    stateNames: data?.stateNames ?? [],
    districtIds: data?.districtIds ?? [],
    projectTotal: data?.projectTotal ?? null,
    enabled,
    isLoading,
    error,
  }
}
