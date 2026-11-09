import type { FindingCode, Finding } from '../../api/types'
import type { BadgeVariant } from '../../components/ui/Badge'

export const FINDING_LABELS: Record<FindingCode, string> = {
  FOREST_LAND: 'Forest land',
  WATER_BODY: 'Water body',
  GOVERNMENT_LAND: 'Government land',
  NOT_IN_ACQUISITION_CASE: 'Not in an acquisition case',
  NO_ACQUISITION_CASE_YET: 'No acquisition case yet',
  IN_ANOTHER_PROJECT_CASE: 'In another project case',
  AREA_TO_ACQUIRE_DIFFERS: 'Area to acquire differs',
  BOUNDARY_AREA_DIFFERS_FROM_RECORD: 'Drawn area differs from the record',
  CASE_PARCEL_OUTSIDE_CORRIDOR: 'Case parcel outside the corridor',
  CASE_PARCEL_WITHOUT_BOUNDARY: 'Case parcel without a boundary',
  PARCEL_OVERLAP: 'Parcel overlap',
  SURVEY_POINT_OUTSIDE_PARCEL: 'Survey point outside the parcel',
  PARCELS_WITHOUT_BOUNDARY: 'Parcels without a boundary',
}

export const SEVERITY_LABELS: Record<Finding['severity'], string> = {
  WARNING: 'Warning',
  INFO: 'Information',
}

export const SEVERITY_VARIANTS: Record<Finding['severity'], BadgeVariant> = {
  WARNING: 'warning',
  INFO: 'info',
}

export const SEVERITY_ORDER: Record<Finding['severity'], number> = {
  WARNING: 0,
  INFO: 1,
}

export function findingLabel(code: string): string {
  return FINDING_LABELS[code as FindingCode] ?? code
}
