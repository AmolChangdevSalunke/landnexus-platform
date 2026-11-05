import {
  listMaster,
  type MasterParentOption,
  type MasterRecord,
  type MasterRequest,
  type MasterResource,
  type MasterResponseByResource,
} from '../../../api/administration'
import { readAllPages } from '../../../api/pagination'
import type { DepartmentLevel } from '../../../api/types'

export const MASTER_CODE_MAX = 30
export const MASTER_NAME_MAX = 150

export const DEPARTMENT_LEVELS: DepartmentLevel[] = [
  'CENTRAL',
  'STATE',
  'DIVISION',
  'DISTRICT',
]

export const DEPARTMENT_LEVEL_LABELS: Record<DepartmentLevel, string> = {
  CENTRAL: 'Central',
  STATE: 'State',
  DIVISION: 'Division',
  DISTRICT: 'District',
}

export interface MasterParentConfig {
  /** The request field that carries the parent id, e.g. ministryId. */
  field: 'ministryId' | 'stateId' | 'districtId' | 'talukaId'
  /** The master resource used to fill the parent select. */
  resource: MasterResource
  label: string
  required: boolean
  hint: string
}

export interface MasterResourceConfig {
  key: MasterResource
  title: string
  singular: string
  description: string
  parent?: MasterParentConfig
  hasLevel?: boolean
  hasOptionalDivision?: boolean
}

export const MASTER_CONFIGS: Record<MasterResource, MasterResourceConfig> = {
  ministries: {
    key: 'ministries',
    title: 'Ministries',
    singular: 'ministry',
    description:
      'Government ministries. Records are deactivated instead of deleted so history stays intact.',
  },
  departments: {
    key: 'departments',
    title: 'Departments',
    singular: 'department',
    description:
      'Departments belong to a ministry and carry the administrative level at which they operate.',
    parent: {
      field: 'ministryId',
      resource: 'ministries',
      label: 'Ministry',
      required: true,
      hint: 'Every department belongs to exactly one ministry.',
    },
    hasLevel: true,
  },
  states: {
    key: 'states',
    title: 'States',
    singular: 'state',
    description: 'States are the top level of the administrative geography.',
  },
  divisions: {
    key: 'divisions',
    title: 'Divisions',
    singular: 'division',
    description: 'Divisions group districts inside a state.',
    parent: {
      field: 'stateId',
      resource: 'states',
      label: 'State',
      required: true,
      hint: 'Every division belongs to exactly one state.',
    },
  },
  districts: {
    key: 'districts',
    title: 'Districts',
    singular: 'district',
    description:
      'Districts belong to a state and may optionally be grouped into a division of that state.',
    parent: {
      field: 'stateId',
      resource: 'states',
      label: 'State',
      required: true,
      hint: 'Every district belongs to exactly one state.',
    },
    hasOptionalDivision: true,
  },
  talukas: {
    key: 'talukas',
    title: 'Talukas',
    singular: 'taluka',
    description: 'Talukas belong to a district.',
    parent: {
      field: 'districtId',
      resource: 'districts',
      label: 'District',
      required: true,
      hint: 'Every taluka belongs to exactly one district.',
    },
  },
  villages: {
    key: 'villages',
    title: 'Villages',
    singular: 'village',
    description: 'Villages belong to a taluka and are the smallest administrative unit.',
    parent: {
      field: 'talukaId',
      resource: 'talukas',
      label: 'Taluka',
      required: true,
      hint: 'Every village belongs to exactly one taluka.',
    },
  },
}

/** Reads every page of a small master-data reference list. */
export async function loadAllMasterRecords<K extends MasterResource>(
  resource: K,
): Promise<MasterResponseByResource[K][]> {
  return readAllPages((page) => listMaster(resource, { page, size: 100 }))
}

/** Parent records for a filter or form select. */
export async function loadMasterParentOptions(
  resource: MasterResource,
): Promise<MasterParentOption[]> {
  const records = await loadAllMasterRecords(resource)
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    status: record.status,
  }))
}

export interface MasterFormValues {
  code: string
  name: string
  parentId: string
  divisionId: string
  level: DepartmentLevel | ''
}

export type MasterFormErrors = Partial<Record<keyof MasterFormValues, string>>

export function emptyMasterForm(): MasterFormValues {
  return {
    code: '',
    name: '',
    parentId: '',
    divisionId: '',
    level: '',
  }
}

/** Converts a response record into form values, using runtime field guards. */
export function masterToFormValues(record: MasterRecord): MasterFormValues {
  const base = {
    code: record.code,
    name: record.name,
    parentId: '',
    divisionId: '',
    level: '' as const,
  }

  if ('level' in record) {
    return {
      ...base,
      parentId: record.ministryId,
      level: record.level,
    }
  }

  if ('divisionId' in record) {
    return {
      ...base,
      parentId: record.stateId,
      divisionId: record.divisionId ?? '',
    }
  }

  if ('talukaId' in record) {
    return { ...base, parentId: record.talukaId }
  }

  if ('districtId' in record) {
    return { ...base, parentId: record.districtId }
  }

  if ('stateId' in record) {
    return { ...base, parentId: record.stateId }
  }

  return base
}

/** Builds the exact request shape the backend expects for a resource. */
export function buildMasterRequest(
  key: MasterResource,
  values: MasterFormValues,
): MasterRequest {
  const code = values.code.trim()
  const name = values.name.trim()

  switch (key) {
    case 'ministries':
      return { code, name }
    case 'departments':
      return {
        code,
        name,
        ministryId: values.parentId,
        level: values.level as DepartmentLevel,
      }
    case 'states':
      return { code, name }
    case 'divisions':
      return { code, name, stateId: values.parentId }
    case 'districts':
      return {
        code,
        name,
        stateId: values.parentId,
        divisionId: values.divisionId || null,
      }
    case 'talukas':
      return { code, name, districtId: values.parentId }
    case 'villages':
      return { code, name, talukaId: values.parentId }
  }
}

export function validateMasterForm(
  config: MasterResourceConfig,
  values: MasterFormValues,
): MasterFormErrors {
  const errors: MasterFormErrors = {}
  const code = values.code.trim()
  const name = values.name.trim()

  if (!code) {
    errors.code = 'Code is required.'
  } else if (code.length > MASTER_CODE_MAX) {
    errors.code = `Code must be at most ${MASTER_CODE_MAX} characters.`
  }

  if (!name) {
    errors.name = 'Name is required.'
  } else if (name.length > MASTER_NAME_MAX) {
    errors.name = `Name must be at most ${MASTER_NAME_MAX} characters.`
  }

  if (config.parent?.required && !values.parentId) {
    errors.parentId = `Select a ${config.parent.label.toLowerCase()}.`
  }

  if (config.hasLevel && !values.level) {
    errors.level = 'Select a department level.'
  }

  return errors
}

/** Maps a form field to the field name used by the backend error payload. */
export function masterServerField(config: MasterResourceConfig, field: keyof MasterFormValues) {
  if (field === 'parentId') {
    return config.parent?.field ?? 'parentId'
  }
  return field
}

/** Parent name already embedded in each child response. */
export function masterParentName(record: MasterRecord): string | null {
  if ('ministryName' in record) {
    return record.ministryName
  }
  if ('talukaName' in record) {
    return record.talukaName
  }
  if ('districtName' in record) {
    return record.districtName
  }
  if ('stateName' in record) {
    return record.stateName
  }
  return null
}

export function masterDivisionName(record: MasterRecord): string | null {
  return 'divisionName' in record ? record.divisionName : null
}
