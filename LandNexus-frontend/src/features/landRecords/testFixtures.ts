import type {
  DistrictResponse,
  DocumentResponse,
  LandownerSummary,
  OwnershipResponse,
  ParcelResponse,
  TalukaResponse,
  VillageResponse,
} from '../../api/types'
import { TEST_USER } from '../../test/handlers'

export const LAND_USER = {
  ...TEST_USER,
  permissions: ['LAND_RECORD_READ', 'LAND_RECORD_WRITE'],
}

export function authWith(permissions: string[]) {
  return {
    user: { ...TEST_USER, permissions },
    accessToken: 'test-access-token',
    status: 'authenticated' as const,
    error: null,
  }
}

export const DISTRICT: DistrictResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  code: 'PUNE',
  name: 'Pune',
  status: 'ACTIVE',
  stateId: '11111111-1111-1111-1111-111111111111',
  stateName: 'Maharashtra',
  divisionId: null,
  divisionName: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

export const TALUKA: TalukaResponse = {
  id: '33333333-3333-3333-3333-333333333333',
  code: 'HAVELI',
  name: 'Haveli',
  status: 'ACTIVE',
  districtId: DISTRICT.id,
  districtName: DISTRICT.name,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

export const VILLAGE: VillageResponse = {
  id: '44444444-4444-4444-4444-444444444444',
  code: 'V1',
  name: 'Village One',
  status: 'ACTIVE',
  talukaId: TALUKA.id,
  talukaName: TALUKA.name,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

export const PARCEL: ParcelResponse = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  stateId: DISTRICT.stateId,
  districtId: DISTRICT.id,
  talukaId: TALUKA.id,
  villageId: VILLAGE.id,
  gatNumber: '123',
  surveyNumber: '45/2',
  subdivisionNumber: null,
  areaHa: 1.25,
  classification: 'AGRICULTURAL_IRRIGATED',
  landUse: 'CULTIVATION',
  status: 'ACTIVE',
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-02-01T10:00:00Z',
}

export const LANDOWNER: LandownerSummary = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  districtId: DISTRICT.id,
  ownerType: 'INDIVIDUAL',
  fullName: 'Sunita Patil',
}

export const OWNERSHIP_MASKED: OwnershipResponse = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  parcelId: PARCEL.id,
  landownerId: LANDOWNER.id,
  ownerName: null,
  ownerType: null,
  sharePercent: 40,
  basis: 'SALE',
  fromDate: '2020-06-01',
  toDate: null,
  current: true,
  remarks: null,
}

export const OWNERSHIP_NAMED: OwnershipResponse = {
  ...OWNERSHIP_MASKED,
  ownerName: LANDOWNER.fullName,
  ownerType: LANDOWNER.ownerType,
}

const SHA256 = 'd2a84f4b8b650937ec8f73cd8be2c74add5a911ba64df27458ed8229da804a26'

export const DOCUMENT: DocumentResponse = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  parcelId: PARCEL.id,
  category: 'SEVEN_TWELVE_EXTRACT',
  title: '7/12 extract 2025',
  currentVersionNo: 1,
  verificationStatus: 'PENDING',
  verifiedVersionNo: null,
  verifiedByUserId: null,
  verifiedAt: null,
  verificationRemarks: null,
  createdAt: '2026-02-02T09:00:00Z',
  updatedAt: '2026-02-02T09:00:00Z',
  versions: [
    {
      versionNo: 1,
      originalFilename: 'extract.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      sha256: SHA256,
      uploadedByUsername: 'other.officer',
      uploadedAt: '2026-02-02T09:00:00Z',
    },
  ],
}

export const DOCUMENT_OWN = {
  ...DOCUMENT,
  versions: [
    {
      ...DOCUMENT.versions[0],
      uploadedByUsername: TEST_USER.username,
    },
  ],
}
