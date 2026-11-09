import type {
  DocumentCategory,
  LandClassification,
  LandUse,
  MutationType,
  OwnerType,
  OwnershipBasis,
  ParcelResponse,
  RevenueRecordType,
  VerificationStatus,
} from '../../api/types'
import type { BadgeVariant } from '../../components/ui/Badge'

export const LAND_CLASSIFICATION_LABELS: Record<LandClassification, string> = {
  AGRICULTURAL_IRRIGATED: 'Agricultural (irrigated)',
  AGRICULTURAL_DRY: 'Agricultural (dry)',
  NON_AGRICULTURAL: 'Non-agricultural',
  FOREST: 'Forest',
  GOVERNMENT: 'Government',
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  INDUSTRIAL: 'Industrial',
  WASTE_LAND: 'Waste land',
  OTHER: 'Other',
}

export const LAND_USE_LABELS: Record<LandUse, string> = {
  CULTIVATION: 'Cultivation',
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  INDUSTRIAL: 'Industrial',
  ROAD: 'Road',
  WATER_BODY: 'Water body',
  VACANT: 'Vacant',
  OTHER: 'Other',
}

export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
  INDIVIDUAL: 'Individual',
  GOVERNMENT: 'Government',
  INSTITUTION: 'Institution',
}

export const OWNERSHIP_BASIS_LABELS: Record<OwnershipBasis, string> = {
  ORIGINAL: 'Original',
  INHERITANCE: 'Inheritance',
  SALE: 'Sale',
  GIFT: 'Gift',
  PARTITION: 'Partition',
  COURT_ORDER: 'Court order',
  OTHER: 'Other',
}

export const MUTATION_TYPE_LABELS: Record<MutationType, string> = {
  SALE: 'Sale',
  INHERITANCE: 'Inheritance',
  GIFT: 'Gift',
  PARTITION: 'Partition',
  MORTGAGE: 'Mortgage',
  COURT_ORDER: 'Court order',
  OTHER: 'Other',
}

export const REVENUE_RECORD_TYPE_LABELS: Record<RevenueRecordType, string> = {
  SEVEN_TWELVE: '7/12 extract',
  EIGHT_A: '8A extract',
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  SEVEN_TWELVE_EXTRACT: '7/12 extract',
  EIGHT_A_EXTRACT: '8A extract',
  MUTATION_ENTRY: 'Mutation entry',
  SALE_DEED: 'Sale deed',
  SURVEY_MAP: 'Survey map',
  NOTICE: 'Notice',
  OTHER: 'Other',
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'Pending verification',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
}

export const VERIFICATION_STATUS_VARIANTS: Record<VerificationStatus, BadgeVariant> = {
  PENDING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
}

export const HIDDEN_OWNER_LABEL = 'Hidden (no permission to see owner details)'

/** Readable parcel label built only from identifiers returned by the backend. */
export function parcelIdentifier(parcel: ParcelResponse): string {
  const parts: string[] = []
  if (parcel.gatNumber) {
    parts.push(`Gat ${parcel.gatNumber}`)
  }
  if (parcel.surveyNumber) {
    parts.push(`Survey ${parcel.surveyNumber}`)
  }
  if (parcel.subdivisionNumber) {
    parts.push(`Subdivision ${parcel.subdivisionNumber}`)
  }
  return parts.join(' · ') || 'Parcel'
}

export const PARCEL_STATUS_LABELS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
} as const

export const PARCEL_STATUS_VARIANTS = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
} as const

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png'])

export function documentExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Client-side checks only; the backend inspects the real file content. */
export function validateDocumentFile(file: File | null): string | null {
  if (!file) {
    return 'Choose a file to upload.'
  }
  if (file.size <= 0) {
    return 'The file is empty.'
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return 'The file is larger than 10 MB.'
  }
  if (!ALLOWED_EXTENSIONS.has(documentExtension(file.name))) {
    return 'Only PDF, JPEG and PNG files are accepted.'
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
