/**
 * API payloads for the LandNexus backend.
 * Keep this file in sync with the backend contract (section 5 of the frontend brief).
 * IDs are UUID strings, dates are ISO yyyy-MM-dd, timestamps are ISO-8601 UTC instants.
 */

export interface ApiFieldError {
  field: string
  message: string
}

export interface ApiError {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
  fieldErrors: ApiFieldError[]
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type RecordStatus = 'ACTIVE' | 'INACTIVE'

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresInSeconds: number
}

export interface CurrentUser {
  id: string
  username: string
  fullName: string
  email: string
  roles: string[]
  permissions: string[]
}

/* ------------------------------------------------------------------ */
/* Master data                                                         */
/* ------------------------------------------------------------------ */

export interface MasterBase {
  id: string
  code: string
  name: string
  status: RecordStatus
  createdAt: string
  updatedAt: string
}

export interface MinistryResponse extends MasterBase {}
export interface StateResponse extends MasterBase {}

export type DepartmentLevel = 'CENTRAL' | 'STATE' | 'DIVISION' | 'DISTRICT'

export interface DepartmentResponse extends MasterBase {
  ministryId: string
  ministryName: string
  level: DepartmentLevel
}

export interface DivisionResponse extends MasterBase {
  stateId: string
  stateName: string
}

export interface DistrictResponse extends MasterBase {
  stateId: string
  stateName: string
  divisionId: string | null
  divisionName: string | null
}

export interface TalukaResponse extends MasterBase {
  districtId: string
  districtName: string
}

export interface VillageResponse extends MasterBase {
  talukaId: string
  talukaName: string
}

export interface MinistryRequest {
  code: string
  name: string
}

export interface StateRequest {
  code: string
  name: string
}

export interface DepartmentRequest {
  code: string
  name: string
  ministryId: string
  level: DepartmentLevel
}

export interface DivisionRequest {
  code: string
  name: string
  stateId: string
}

export interface DistrictRequest {
  code: string
  name: string
  stateId: string
  divisionId?: string | null
}

export interface TalukaRequest {
  code: string
  name: string
  districtId: string
}

export interface VillageRequest {
  code: string
  name: string
  talukaId: string
}

/* ------------------------------------------------------------------ */
/* Users, roles and scope                                              */
/* ------------------------------------------------------------------ */

export interface UserCreateRequest {
  username: string
  email: string
  fullName: string
  password: string
  roles: string[]
}

export interface UserProfileUpdateRequest {
  email: string
  fullName: string
}

export interface UserPermissionEntry {
  code: string
  description: string
  roleGranted: boolean
  override: boolean | null
  effective: boolean
}

export interface UserPermissions {
  userId: string
  permissions: UserPermissionEntry[]
}

export interface UserPermissionOverrideRequest {
  overrides: Array<{ code: string; granted: boolean }>
}

export interface UserResponse {
  id: string
  username: string
  email: string
  fullName: string
  enabled: boolean
  roles: string[]
  lastLoginAt: string | null
  createdAt: string
}

export interface RoleResponse {
  id: string
  code: string
  name: string
  description: string
  permissions: string[]
}

export interface PermissionResponse {
  id: string
  code: string
  description: string
}

export type ScopeType = 'STATE' | 'DIVISION' | 'DISTRICT'

export interface ScopeEntryResponse {
  id: string
  type: ScopeType
  referenceId: string
  referenceName: string
}

export interface ScopeEntryRequest {
  stateId?: string
  divisionId?: string
  districtId?: string
}

export interface UserScopesRequest {
  scopes: ScopeEntryRequest[]
}

export interface UpdateUserRolesRequest {
  roles: string[]
}

/* ------------------------------------------------------------------ */
/* Audit trail and login history                                       */
/* ------------------------------------------------------------------ */

export interface AuditEventResponse {
  id: string
  occurredAt: string
  actorUserId: string | null
  actorUsername: string
  action: string
  entityType: string
  entityId: string | null
  details: string | null
}

export interface LoginHistoryResponse {
  id: string
  occurredAt: string
  userId: string | null
  usernameAttempted: string
  success: boolean
  failureReason: string | null
  ipAddress: string | null
  userAgent: string | null
}

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

export type ProjectType =
  | 'NATIONAL_HIGHWAY'
  | 'STATE_HIGHWAY'
  | 'DISTRICT_ROAD'
  | 'RURAL_ROAD'
  | 'EXPRESSWAY'
  | 'RAILWAY'
  | 'DAM'
  | 'IRRIGATION'
  | 'SCHOOL'
  | 'HOSPITAL'
  | 'GOVERNMENT_BUILDING'
  | 'OTHER_INFRASTRUCTURE'

export const LINEAR_PROJECT_TYPES: readonly ProjectType[] = [
  'NATIONAL_HIGHWAY',
  'STATE_HIGHWAY',
  'DISTRICT_ROAD',
  'RURAL_ROAD',
  'EXPRESSWAY',
  'RAILWAY',
]

export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'CLARIFICATION_REQUESTED'
  | 'RECOMMENDED'
  | 'APPROVED'
  | 'REJECTED'

export type ProposalAction =
  | 'SUBMIT'
  | 'RESUBMIT'
  | 'START_SCRUTINY'
  | 'REQUEST_CLARIFICATION'
  | 'RECOMMEND'
  | 'REJECT_SCRUTINY'
  | 'APPROVE'
  | 'REJECT'
  | 'REOPEN'

export interface ProposalRequest {
  title: string
  projectType: ProjectType
  districtId: string
  talukaId?: string | null
  departmentId: string
  lengthKm?: number | null
  estimatedLandAreaHa: number
  villageIds: string[]
  alignmentDescription?: string | null
  description: string
  plannedStartDate: string
  plannedEndDate: string
}

export interface ProposalResponse {
  id: string
  proposalNumber: string | null
  title: string
  projectType: ProjectType
  status: ProposalStatus
  versionNo: number
  stateId: string
  districtId: string
  talukaId: string | null
  departmentId: string
  lengthKm: number | null
  estimatedLandAreaHa: number
  villageIds: string[]
  alignmentDescription: string | null
  description: string
  plannedStartDate: string
  plannedEndDate: string
  ownerUserId: string
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  projectCode: string | null
  acquisitionCaseNumber?: string | null
  availableActions: ProposalAction[]
}

export interface ProposalHistoryEntry {
  id: string
  fromStatus: ProposalStatus | null
  toStatus: ProposalStatus
  action: string
  actorUsername: string
  reason: string | null
  occurredAt: string
}

export interface ProposalVersion {
  versionNo: number
  createdByUsername: string
  createdAt: string
  snapshot: string
}

export interface ProposalValidationItem {
  code: string
  severity: 'PASS' | 'WARN' | 'FAIL'
  message: string
}

export interface ProposalValidationResponse {
  proposalId: string
  passed: boolean
  items: ProposalValidationItem[]
}

/* ------------------------------------------------------------------ */
/* Proposal routing and assignments (NLAMS)                            */
/* ------------------------------------------------------------------ */

export type AssignmentStage = 'SCRUTINY' | 'DECISION'

export type AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REASSIGNED'

export interface ProposalAssignment {
  id: string
  proposalId: string
  stage: AssignmentStage
  assignedUserId: string
  assignedUsername: string | null
  assignedBy: string
  ruleNote: string | null
  status: AssignmentStatus
  assignedAt: string
  startedAt: string | null
  completedAt: string | null
  dueAt: string | null
  overdue: boolean
}

export interface ReassignmentCandidate {
  id: string
  username: string
  scopeLevel: 'CENTRAL' | 'STATE' | 'DISTRICT' | 'NONE'
}

export interface MyTask {
  assignmentId: string
  proposalId: string
  proposalNumber: string | null
  title: string | null
  stage: AssignmentStage
  assignmentStatus: AssignmentStatus
  proposalStatus: ProposalStatus | null
  assignedAt: string
  dueAt: string | null
  overdue: boolean
  estimatedLandAreaHa: number | null
  districtId: string | null
  districtName: string | null
  projectType: ProjectType | null
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export type RoutingDecisionLevel = 'DISTRICT' | 'STATE' | 'CENTRAL'
export type RoutingProjectType =
  | 'NATIONAL_HIGHWAY'
  | 'STATE_HIGHWAY'
  | 'DISTRICT_ROAD'
  | 'RURAL_ROAD'
  | 'EXPRESSWAY'
  | 'RAILWAY'
  | 'DAM'
  | 'IRRIGATION'
  | 'SCHOOL'
  | 'HOSPITAL'
  | 'GOVERNMENT_BUILDING'
  | 'OTHER_INFRASTRUCTURE'

export interface RoutingRuleResponse {
  id: string
  name: string
  minAreaHa: number | null
  maxAreaHa: number | null
  projectType: RoutingProjectType | null
  decisionLevel: RoutingDecisionLevel
  active: boolean
  note: string | null
  createdAt: string
}

export interface RoutingRuleRequest {
  name: string
  minAreaHa: number | null
  maxAreaHa: number | null
  projectType: RoutingProjectType | null
  decisionLevel: RoutingDecisionLevel
  note: string | null
}

export type ProjectStatus = 'ACTIVE' | 'CLOSED'

export interface ProjectResponse {
  id: string
  code: string
  proposalId: string
  title: string
  projectType: ProjectType
  status: ProjectStatus
  stateId: string
  districtId: string
  talukaId: string | null
  departmentId: string
  lengthKm: number | null
  estimatedLandAreaHa: number
  villageIds: string[]
  ownerUserId: string
  approvedByUserId: string
  approvedAt: string
  createdAt: string
}

/** The editable part of a project. Code, proposal and approval facts are immutable. */
export interface ProjectUpdateRequest {
  title: string
  projectType: ProjectType
  districtId: string
  talukaId: string | null
  departmentId: string
  lengthKm: number | null
  estimatedLandAreaHa: number
  villageIds: string[]
}

/* ------------------------------------------------------------------ */
/* Land records (Module 3)                                             */
/* ------------------------------------------------------------------ */

export type LandClassification =
  | 'AGRICULTURAL_IRRIGATED'
  | 'AGRICULTURAL_DRY'
  | 'NON_AGRICULTURAL'
  | 'FOREST'
  | 'GOVERNMENT'
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'INDUSTRIAL'
  | 'WASTE_LAND'
  | 'OTHER'

export type LandUse =
  | 'CULTIVATION'
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'INDUSTRIAL'
  | 'ROAD'
  | 'WATER_BODY'
  | 'VACANT'
  | 'OTHER'

export interface ParcelRequest {
  villageId: string
  gatNumber?: string | null
  surveyNumber?: string | null
  subdivisionNumber?: string | null
  areaHa: number
  classification: LandClassification
  landUse: LandUse
}

export interface ParcelResponse {
  id: string
  stateId: string
  districtId: string
  talukaId: string
  villageId: string
  gatNumber: string | null
  surveyNumber: string | null
  subdivisionNumber: string | null
  areaHa: number
  classification: LandClassification
  landUse: LandUse
  status: RecordStatus
  createdAt: string
  updatedAt: string
}

export type OwnerType = 'INDIVIDUAL' | 'GOVERNMENT' | 'INSTITUTION'

export interface LandownerRequest {
  districtId: string
  ownerType: OwnerType
  fullName: string
  guardianName?: string | null
  address?: string | null
  phone?: string | null
}

export interface LandownerSummary {
  id: string
  districtId: string
  ownerType: OwnerType
  fullName: string
}

export interface LandownerResponse extends LandownerSummary {
  guardianName: string | null
  address: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
}

export type OwnershipBasis =
  | 'ORIGINAL'
  | 'INHERITANCE'
  | 'SALE'
  | 'GIFT'
  | 'PARTITION'
  | 'COURT_ORDER'
  | 'OTHER'

export interface OwnershipRequest {
  landownerId: string
  sharePercent: number
  basis: OwnershipBasis
  fromDate: string
  remarks?: string | null
}

export interface OwnershipResponse {
  id: string
  parcelId: string
  landownerId: string
  /** Null when the caller does not have LANDOWNER_READ (personal data is masked). */
  ownerName: string | null
  ownerType: OwnerType | null
  sharePercent: number
  basis: OwnershipBasis
  fromDate: string
  toDate: string | null
  current: boolean
  remarks: string | null
}

export interface OwnershipEndRequest {
  endDate: string
}

export type MutationType =
  | 'SALE'
  | 'INHERITANCE'
  | 'GIFT'
  | 'PARTITION'
  | 'MORTGAGE'
  | 'COURT_ORDER'
  | 'OTHER'

export interface MutationRequest {
  mutationNumber: string
  mutationDate: string
  mutationType: MutationType
  description?: string | null
}

export interface MutationResponse extends MutationRequest {
  id: string
  parcelId: string
  createdBy: string | null
  createdAt: string
}

export type RevenueRecordType = 'SEVEN_TWELVE' | 'EIGHT_A'

export interface RevenueRecordRequest {
  recordType: RevenueRecordType
  extractDate: string
  khataNumber?: string | null
  particulars: string
}

export interface RevenueRecordResponse extends RevenueRecordRequest {
  id: string
  parcelId: string
  createdBy: string | null
  createdAt: string
}

export type DocumentCategory =
  | 'SEVEN_TWELVE_EXTRACT'
  | 'EIGHT_A_EXTRACT'
  | 'MUTATION_ENTRY'
  | 'SALE_DEED'
  | 'SURVEY_MAP'
  | 'NOTICE'
  | 'OTHER'

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface DocumentVersion {
  versionNo: number
  originalFilename: string
  contentType: string
  sizeBytes: number
  sha256: string
  uploadedByUsername: string
  uploadedAt: string
}

export interface DocumentResponse {
  id: string
  parcelId: string
  category: DocumentCategory
  title: string
  currentVersionNo: number
  verificationStatus: VerificationStatus
  verifiedVersionNo: number | null
  verifiedByUserId: string | null
  verifiedAt: string | null
  verificationRemarks: string | null
  createdAt: string
  updatedAt: string
  versions: DocumentVersion[]
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  read: boolean
  createdAt: string
}

export interface UnreadCountResponse {
  unread: number
}

/* ------------------------------------------------------------------ */
/* Land acquisition (Module 4)                                         */
/* ------------------------------------------------------------------ */

export type CaseStatus =
  | 'INITIATED'
  | 'SURVEY_IN_PROGRESS'
  | 'VERIFICATION_COMPLETE'
  | 'NOTIFICATION_ISSUED'
  | 'READY_FOR_AWARD'
  | 'AWARD_DECLARED'
  | 'POSSESSION_TAKEN'
  | 'CLOSED'
  | 'CANCELLED'

export type Framework =
  | 'LARR_2013'
  | 'NATIONAL_HIGHWAYS_ACT_1956'
  | 'RAILWAYS_ACT_1989'
  | 'STATE_ACT'
  | 'OTHER'

export interface CaseRequest {
  projectId: string
  framework: Framework
  frameworkNote?: string | null
  description?: string | null
}

export interface CaseResponse {
  id: string
  caseNumber: string
  projectId: string
  stateId: string
  districtId: string
  framework: Framework
  frameworkNote: string | null
  description: string | null
  status: CaseStatus
  villageIds: string[]
  createdAt: string
  updatedAt: string
  /** Actions the backend says this user may take now. */
  availableActions: string[]
}

export type CaseAction =
  | 'START_SURVEY'
  | 'COMPLETE_VERIFICATION'
  | 'ISSUE_NOTIFICATION'
  | 'CLOSE_OBJECTION_WINDOW'
  | 'DECLARE_AWARD'
  | 'COMPLETE_POSSESSION'
  | 'CLOSE'
  | 'CANCEL'

export interface CaseParcelOwnerShare {
  landownerId: string
  sharePercent: number
}

export type SurveyStatus = 'SUBMITTED' | 'VERIFIED' | 'REJECTED'

export interface CaseParcel {
  id: string
  caseId: string
  parcelId: string
  villageId: string
  areaToAcquireHa: number
  assignedSurveyorUserId: string | null
  surveyStatus: SurveyStatus | null
  owners: CaseParcelOwnerShare[]
  identifiedAt: string
}

export interface SurveyRequest {
  surveyedOn: string
  measuredAreaHa: number
  gpsLatitude: number
  gpsLongitude: number
  fieldNotes?: string | null
}

export interface SurveyResponse {
  id: string
  caseId: string
  caseParcelId: string
  surveyorUsername: string
  surveyedOn: string
  measuredAreaHa: number
  recordedAreaHa: number
  variancePercent: number
  gpsLatitude: number
  gpsLongitude: number
  fieldNotes: string | null
  status: SurveyStatus
  verifiedByUserId: string | null
  verifiedAt: string | null
  verificationRemarks: string | null
  createdAt: string
}

export type NoticeType =
  | 'PRELIMINARY_NOTIFICATION'
  | 'FINAL_DECLARATION'
  | 'AWARD_NOTICE'
  | 'POSSESSION_NOTICE'
  | 'OTHER'

export interface NoticeRequest {
  noticeType: NoticeType
  referenceNumber: string
  issuedOn: string
  objectionDeadline?: string | null
  description?: string | null
}

export interface NoticeResponse {
  id: string
  caseId: string
  noticeType: NoticeType
  referenceNumber: string
  issuedOn: string
  objectionDeadline: string | null
  description: string | null
  createdBy: string | null
}

export type ObjectionStatus = 'OPEN' | 'ACCEPTED' | 'DISMISSED'

export interface ObjectionRequest {
  caseParcelId: string
  receivedOn: string
  grounds: string
  objectorReference?: string | null
}

export interface ObjectionResponse {
  id: string
  caseId: string
  caseParcelId: string
  objectionNumber: string
  receivedOn: string
  grounds: string
  /** Null when the caller does not have LANDOWNER_READ (personal data is masked). */
  objectorReference: string | null
  status: ObjectionStatus
  registeredByUserId: string
  decidedByUserId: string | null
  decidedAt: string | null
  decisionRemarks: string | null
}

export interface DeclareAwardRequest {
  awardNumber: string
  awardDate: string
  remarks?: string | null
}

export interface AwardLine {
  caseParcelId: string
  parcelId: string
  awardedAreaHa: number
}

export interface AwardResponse {
  id: string
  caseId: string
  awardNumber: string
  awardDate: string
  remarks: string | null
  declaredByUserId: string
  lines: AwardLine[]
}

export type PossessionType = 'PHYSICAL' | 'DEEMED'

export interface PossessionRequest {
  caseParcelId: string
  possessionDate: string
  possessionType: PossessionType
  remarks?: string | null
}

export interface PossessionResponse {
  id: string
  caseId: string
  caseParcelId: string
  possessionDate: string
  possessionType: PossessionType
  remarks: string | null
  recordedByUserId: string
}

export interface PhotoResponse {
  id: string
  surveyId: string
  originalFilename: string
  contentType: string
  sizeBytes: number
  sha256: string
  gpsLatitude: number
  gpsLongitude: number
  capturedAt: string | null
  uploadedByUsername: string
  uploadedAt: string
}

export interface AcquisitionHistoryEntry {
  id: string
  fromStatus: CaseStatus | null
  toStatus: CaseStatus
  action: string
  actorUsername: string
  reason: string | null
  occurredAt: string
}

export type SurveyState =
  | 'VERIFIED'
  | 'AWAITING_VERIFICATION'
  | 'REJECTED_ONLY'
  | 'NOT_SURVEYED'

export interface ParcelReportRow {
  caseParcelId: string
  parcelId: string
  recordedAreaHa: number | null
  areaToAcquireHa: number
  surveyState: SurveyState
  measuredAreaHa: number | null
  variancePercent: number | null
  gpsLatitude: number | null
  gpsLongitude: number | null
  surveyorUsername: string | null
  verifiedAt: string | null
}

export interface VerificationReport {
  caseId: string
  caseNumber: string
  status: CaseStatus
  totalParcels: number
  verified: number
  awaitingVerification: number
  rejectedOnly: number
  notSurveyed: number
  totalAreaToAcquireHa: number
  parcels: ParcelReportRow[]
}

/* ------------------------------------------------------------------ */
/* Valuation, compensation, payments and R&R (Module 5)                */
/* ------------------------------------------------------------------ */

export type RateStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface RateRequest {
  villageId: string
  classification: LandClassification
  ratePerHa: number
  effectiveFrom: string
  sourceNote?: string | null
}

export interface RateResponse {
  id: string
  villageId: string
  districtId: string
  classification: LandClassification
  ratePerHa: number
  effectiveFrom: string
  sourceNote: string | null
  status: RateStatus
  createdByUserId: string
  approvedByUserId: string | null
  decidedAt: string | null
  decisionRemarks: string | null
}

export type ComponentType = 'LAND_VALUE' | 'ASSET_VALUE' | 'PERCENT_OF' | 'FIXED_PER_HECTARE'

export interface ComponentRequest {
  code: string
  name: string
  type: ComponentType
  factor?: number | null
  baseCodes?: string[] | null
}

export interface RuleSetRequest {
  name: string
  framework: Framework
  stateId?: string | null
  districtId?: string | null
  effectiveFrom: string
  effectiveTo?: string | null
  description?: string | null
  components: ComponentRequest[]
}

export interface RuleSetComponent {
  position: number
  code: string
  name: string
  type: ComponentType
  factor: number
  baseCodes: string[]
}

export type RuleSetStatus = 'DRAFT' | 'APPROVED' | 'RETIRED'

export interface RuleSetResponse {
  id: string
  name: string
  version: number
  framework: Framework
  stateId: string | null
  districtId: string | null
  effectiveFrom: string
  effectiveTo: string | null
  description: string | null
  status: RuleSetStatus
  createdByUserId: string
  approvedByUserId: string | null
  approvedAt: string | null
  retireReason: string | null
  components: RuleSetComponent[]
}

export type AssetCategory = 'BUILDING' | 'TREE' | 'WELL' | 'CROP' | 'OTHER'

export interface AssetRequest {
  category: AssetCategory
  description: string
  quantity: number
  unit: string
  unitValue: number
}

export interface AssetResponse {
  id: string
  caseParcelId: string
  category: AssetCategory
  description: string
  quantity: number
  unit: string
  unitValue: number
  value: number
  voided: boolean
  voidReason: string | null
}

export type ValuationStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'
export type ValuationAction = 'SUBMIT' | 'RECALCULATE' | 'APPROVE' | 'REJECT'

export interface ValuationLine {
  position: number
  code: string
  name: string
  type: ComponentType
  basis: string
  amount: number
}

export interface ValuationResponse {
  id: string
  caseId: string
  caseParcelId: string
  parcelId: string
  versionNo: number
  awardedAreaHa: number
  classification: LandClassification
  ratePerHa: number
  ruleSetName: string
  ruleSetVersion: number
  referenceDate: string
  assetTotal: number
  totalAmount: number
  status: ValuationStatus
  preparedByUsername: string
  decidedByUserId: string | null
  decidedAt: string | null
  decisionRemarks: string | null
  createdAt: string
  lines: ValuationLine[]
  availableActions: ValuationAction[]
}

export type EstimateStatus = 'NOT_ESTIMATED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED'

export interface CompensationSummaryRow {
  caseParcelId: string
  parcelId: string
  awardedAreaHa: number
  estimateStatus: EstimateStatus
  valuationId: string | null
  totalAmount: number | null
}

export interface CompensationSummary {
  caseId: string
  caseNumber: string
  parcels: number
  approved: number
  submitted: number
  draft: number
  notEstimated: number
  approvedTotal: number
  rows: CompensationSummaryRow[]
}

export type PaymentStatus = 'INSTRUCTED' | 'SENT' | 'CONFIRMED' | 'FAILED'
export type PaymentAction = 'RELEASE' | 'RETRY' | 'SIMULATE_CONFIRMED' | 'SIMULATE_FAILED'
export type PaymentChannel =
  | 'UNCLASSIFIED'
  | 'PFMS_SIMULATED'
  | 'DBT_SIMULATED'
  | 'OTHER_SIMULATED'

export interface PaymentResponse {
  id: string
  valuationId: string
  caseId: string
  caseParcelId: string
  landownerId: string
  sharePercent: number
  amount: number
  status: PaymentStatus
  paymentChannel: PaymentChannel
  mode: 'SIMULATED'
  reference: string | null
  failureReason: string | null
  attemptCount: number
  releasedAt: string | null
  confirmedAt: string | null
  availableActions: PaymentAction[]
}

export interface PaymentEventResponse {
  id: string
  fromStatus: PaymentStatus | null
  toStatus: PaymentStatus
  event: string
  actorUsername: string
  detail: string | null
  occurredAt: string
}

export interface PaymentSummary {
  caseId: string
  mode: 'SIMULATED'
  payments: number
  totalAmount: number
  instructedAmount: number
  sentAmount: number
  confirmedAmount: number
  failedAmount: number
}

export type RrBenefitKind = 'ONE_TIME_CASH' | 'MONTHLY_ALLOWANCE' | 'HOUSING' | 'EMPLOYMENT' | 'OTHER'

export interface BenefitTypeRequest {
  code: string
  name: string
  kind: RrBenefitKind
  defaultAmount?: number | null
  defaultMonths?: number | null
  requiresDisplaced?: boolean | null
  requiresLivelihoodLost?: boolean | null
}

export interface BenefitTypeResponse {
  id: string
  code: string
  name: string
  kind: RrBenefitKind
  defaultAmount: number | null
  defaultMonths: number | null
  requiresDisplaced: boolean
  requiresLivelihoodLost: boolean
  active: boolean
}

export type RrCaseStatus = 'IDENTIFIED' | 'ASSESSED' | 'APPROVED' | 'COMPLETED'
export type RrAction = 'ADD_ENTITLEMENT' | 'APPROVE' | 'DELIVER' | 'COMPLETE'

export interface RrCaseRequest {
  landownerId: string
  displaced: boolean
  livelihoodLost: boolean
  notes?: string | null
}

export interface EntitlementRequest {
  benefitTypeId: string
  amount?: number | null
  months?: number | null
}

export interface RrEntitlementResponse {
  id: string
  benefitCode: string
  benefitName: string
  kind: RrBenefitKind
  amount: number | null
  months: number | null
  status: 'PLANNED' | 'DELIVERED'
  deliveredOn: string | null
  deliveryRemarks: string | null
}

export interface RrCaseResponse {
  id: string
  caseId: string
  landownerId: string
  displaced: boolean
  livelihoodLost: boolean
  status: RrCaseStatus
  notes: string | null
  createdByUserId: string
  approvedByUserId: string | null
  decidedAt: string | null
  entitlements: RrEntitlementResponse[]
  availableActions: RrAction[]
}

/* ------------------------------------------------------------------ */
/* GIS (Module 6)                                                      */
/* ------------------------------------------------------------------ */

export interface Geometry {
  type: 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiLineString'
  coordinates: unknown
}

export interface Feature<P> {
  type: 'Feature'
  geometry: Geometry
  properties: P
}

export interface FeatureCollection<P> {
  type: 'FeatureCollection'
  features: Feature<P>[]
}

export interface BoundaryResponse {
  parcelId: string
  versionNo: number
  areaHa: number
  recordedAreaHa: number
  variancePercent: number
  vertices: number
}

export interface BoundaryVersion {
  versionNo: number
  areaHa: number
  vertices: number
  sourceNote: string | null
  enteredByUsername: string
  enteredAt: string
  current: boolean
}

/** GET /parcels/{id}/boundary returns a Feature with these properties. */
export interface BoundaryFeatureProps {
  parcelId: string
  versionNo: number
  areaHa: number
  sourceNote: string | null
}

export interface AlignmentResponse {
  projectId: string
  versionNo: number
  lengthKm: number
  corridorWidthM: number
  vertices: number
}

export interface AlignmentVersion {
  versionNo: number
  lengthKm: number
  corridorWidthM: number
  vertices: number
  sourceNote: string | null
  enteredByUsername: string
  enteredAt: string
  current: boolean
}

/** GET /projects/{id}/alignment returns a Feature with these properties. */
export interface AlignmentFeatureProps {
  kind: 'ALIGNMENT'
  lengthKm: number
  corridorWidthM: number
}

/** GET /projects/{id}/corridor returns a Feature with these properties. */
export interface CorridorFeatureProps {
  kind: 'CORRIDOR'
  corridorWidthM?: number
}

export type MapProps =
  | { kind: 'CORRIDOR'; corridorWidthM?: number }
  | { kind: 'ALIGNMENT'; lengthKm: number; corridorWidthM?: number }
  | {
      kind: 'PARCEL'
      parcelId: string
      gatNumber: string | null
      surveyNumber: string | null
      classification: LandClassification
      landUse: LandUse
      areaHa: number
      inCase: boolean
    }

export type FindingCode =
  | 'FOREST_LAND'
  | 'WATER_BODY'
  | 'GOVERNMENT_LAND'
  | 'NOT_IN_ACQUISITION_CASE'
  | 'NO_ACQUISITION_CASE_YET'
  | 'IN_ANOTHER_PROJECT_CASE'
  | 'AREA_TO_ACQUIRE_DIFFERS'
  | 'BOUNDARY_AREA_DIFFERS_FROM_RECORD'
  | 'CASE_PARCEL_OUTSIDE_CORRIDOR'
  | 'CASE_PARCEL_WITHOUT_BOUNDARY'
  | 'PARCEL_OVERLAP'
  | 'SURVEY_POINT_OUTSIDE_PARCEL'
  | 'PARCELS_WITHOUT_BOUNDARY'

export interface Finding {
  code: FindingCode
  severity: 'WARNING' | 'INFO'
  parcelId: string | null
  message: string
}

export interface AffectedParcel {
  parcelId: string
  gatNumber: string | null
  surveyNumber: string | null
  classification: LandClassification
  landUse: LandUse
  recordedAreaHa: number
  boundaryAreaHa: number
  affectedHa: number
  caseNumber: string | null
  areaToAcquireHa: number | null
  flags: string[]
}

export interface ConflictReport {
  projectId: string
  projectCode: string
  alignmentVersion: number
  corridorWidthM: number
  corridorAreaHa: number
  parcelsInProjectVillages: number
  parcelsWithBoundary: number
  affectedParcelCount: number
  totalAffectedHa: number
  warnings: number
  infos: number
  affectedParcels: AffectedParcel[]
  findings: Finding[]
  limitations: string[]
}

/* Satellite imagery served through the backend. The browser never sees
 * the provider URL or its secret; only these summaries cross the wire. */

/** GET /gis/imagery/status */
export interface ImageryStatus {
  enabled: boolean
  provider: string | null
  kind: string | null
  overlayAvailable: boolean
  attribution: string
  message: string | null
}

/** POST /gis/imagery/test */
export interface ImageryTestResult {
  ok: boolean
  connectionState: 'CONNECTED' | 'AUTHENTICATION_FAILED' | 'UNAVAILABLE' | 'NOT_CONFIGURED'
  httpStatus: number | null
  contentType: string | null
  bytes: number
  elapsedMs: number
  message: string | null
}

/* ------------------------------------------------------------------ */
/* Dashboards, MIS reports, SLA and settings (Module 7)                */
/* ------------------------------------------------------------------ */

export interface StatusAmount {
  status: string
  count: number
  amount: number
}

export interface TrendPoint {
  month: string
  proposalsSubmitted: number
  casesOpened: number
}

export interface DistrictRow {
  districtId: string
  district: string
  state: string
  projects: number
  openCases: number
  parcels: number
  areaToAcquireHa: number
}

export interface DashboardFinance {
  estimates: StatusAmount[]
  payments: StatusAmount[] | null
  rrCasesByStatus: Record<string, number> | null
  pfmsSimulatedPayments: StatusAmount[] | null
  dbtSimulatedPayments: StatusAmount[] | null
  paymentsByChannel: Record<string, StatusAmount[]> | null
  paymentMode: 'SIMULATED' | null
}

export interface OfficerWorkload {
  userId: string
  username: string
  pending: number
  inProgress: number
  overdue: number
}

export interface Dashboard {
  generatedAt: string
  level: 'NATIONAL' | 'STATE' | 'DISTRICT' | 'SCOPED'
  stateId: string | null
  districtId: string | null
  proposals: {
    byStatus: Record<string, number>
    total: number
    inReview: number
    awaitingDecision: number
    approved: number
    rejected: number
  }
  projects: {
    byStatus: Record<string, number>
    total: number
    estimatedLandAreaHa: number
  }
  land: {
    activeParcels: number
    totalAreaHa: number
    parcelsWithBoundary: number
    boundaryCoveragePercent: number
    documentsPendingVerification: number
  }
  acquisition: {
    casesByStatus: Record<string, number>
    totalCases: number
    openCases: number
    parcelsIdentified: number
    areaToAcquireHa: number
    surveysByStatus: Record<string, number>
    objectionsByStatus: Record<string, number>
    awardsDeclared: number
    possessionsRecorded: number
  }
  finance: DashboardFinance | null
  operations: {
    gisConflicts: number
    pendingTasks: number
    escalationsByLevel: Record<string, number>
    officerWorkload: OfficerWorkload[] | null
  }
  trend: TrendPoint[]
  districts: DistrictRow[]
  notes: string[]
}

/* ------------------------------------------------------------------ */
/* NLAMS progress (real-time monitoring)                               */
/* ------------------------------------------------------------------ */

export interface NlamsProject {
  projectId: string
  projectCode: string | null
  title: string
  projectType: ProjectType
  projectStatus: string
  districtId: string
  districtName: string | null
  estimatedLandAreaHa: number
  alignmentLengthKm: number | null
  cases: number
  openCases: number
  casesAwaitingNotification: number
  casesNotified: number
  casesAwaitingAward: number
  casesPossessionComplete: number
  parcelsIdentified: number
  identifiedHa: number
  parcelsNotified: number
  notifiedHa: number
  awards: number
  parcelsAwarded: number
  awardedHa: number
  parcelsPossessed: number
  possessionHa: number
  possessionPhysical: number
  possessionDeemed: number
  notices: number
  objections: number
  objectionsOpen: number
  assessedTotal: number
  awaitingApprovalTotal: number
  paidTotal: number
  sentTotal: number
  failedTotal: number
  instructedTotal: number
  affectedFamilies: number
  displacedFamilies: number
  livelihoodLostFamilies: number
  rrCases: number
  rrCompleted: number
  rrEntitlements: number
  rrDelivered: number
  progressPercent: number
  currentStage: string
}

export interface NlamsTotals {
  projects: number
  projectsInAcquisition: number
  totalCases: number
  openCases: number
  parcelsIdentified: number
  identifiedHa: number
  parcelsNotified: number
  notifiedHa: number
  parcelsAwarded: number
  awardedHa: number
  parcelsPossessed: number
  possessionHa: number
  assessedTotal: number
  paidTotal: number
  sentTotal: number
  failedTotal: number
  affectedFamilies: number
  displacedFamilies: number
  rrEntitlements: number
  rrDelivered: number
}

export interface NlamsDashboard {
  generatedAt: string
  stateId: string | null
  districtId: string | null
  paymentMode: 'SIMULATED'
  totals: NlamsTotals
  projectsByStage: Record<string, number>
  projects: NlamsProject[]
}

export type ReportColumnType = 'TEXT' | 'NUMBER' | 'DATE' | 'MONEY'

export interface ReportColumn {
  key: string
  label: string
  type: ReportColumnType
}

export type ReportCode = 'PROJECTS' | 'ACQUISITION_CASES' | 'COMPENSATION'

export interface ReportInfo {
  code: ReportCode
  title: string
  description: string
  columns: ReportColumn[]
}

export interface ReportResult {
  code: string
  title: string
  columns: ReportColumn[]
  rows: Record<string, string | number | null>[]
  page: number
  size: number
  totalRows: number
}

export type SlaItemType =
  | 'PROPOSAL_AWAITING_SCRUTINY'
  | 'DOCUMENT_AWAITING_VERIFICATION'
  | 'SURVEY_AWAITING_VERIFICATION'
  | 'OBJECTION_AWAITING_DECISION'
  | 'OBJECTION_WINDOW_NOT_CLOSED'
  | 'ESTIMATE_AWAITING_APPROVAL'
  | 'PAYMENT_AWAITING_RELEASE'
  | 'PAYMENT_AWAITING_RESPONSE'

export interface SlaTypeSummary {
  itemType: SlaItemType
  title: string
  onTime: number
  warning: number
  breach: number
  warnAfterHours: number
  breachAfterHours: number
  responsibleRole: string
}

export interface SlaItem {
  itemType: SlaItemType
  title: string
  entityId: string
  reference: string
  districtId: string
  since: string
  ageHours: number
  level: 'WARNING' | 'BREACH'
  responsibleRole: string
}

export interface SlaOverview {
  generatedAt: string
  onTime: number
  warning: number
  breach: number
  byType: SlaTypeSummary[]
  items: SlaItem[]
  itemsTruncated: boolean
  notes: string[]
}

export interface SlaRule {
  id: string
  itemType: SlaItemType
  title: string
  warnAfterHours: number
  breachAfterHours: number
  responsibleRole: string
  escalateRole: string | null
  active: boolean
  note: string | null
  rowVersion: number
}

export interface SlaRuleRequest {
  warnAfterHours: number
  breachAfterHours: number
  responsibleRole: string
  escalateRole?: string | null
  active: boolean
  rowVersion: number
}

export interface ScanResult {
  scannedAt: string
  warningsRaised: number
  breachesRaised: number
  notificationsSent: number
}

export interface Escalation {
  id: string
  itemType: SlaItemType
  entityId: string
  reference: string
  level: 'WARNING' | 'BREACH'
  thresholdHours: number
  since: string
  responsibleRole: string
  escalateRole: string | null
  triggeredBy: string
  createdAt: string
}

export interface EscalationPage {
  rows: Escalation[]
  page: number
  size: number
  totalRows: number
}

export interface Settings {
  paymentMode: 'SIMULATED'
  maxUploadMb: number
  allowedUploadTypes: string[]
  exportMaxRows: number
  slaSchedulerEnabled: boolean
  slaScanIntervalMinutes: number
  businessTimeZone: string
  notes: string[]
}

/* ------------------------------------------------------------------ */
/* Timeline forecast (statistical, from this system's own history)     */
/* ------------------------------------------------------------------ */

export type ForecastRisk = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA'

export interface ForecastStageStat {
  itemType: SlaItemType
  title: string
  samples: number
  medianHours: number | null
  p90Hours: number | null
  warnAfterHours: number
  breachAfterHours: number
  open: number
  atRisk: number
}

export interface ForecastItem {
  itemType: SlaItemType
  title: string
  entityId: string
  reference: string
  districtId: string
  since: string
  ageHours: number
  risk: ForecastRisk
  breachProbability: number | null
  expectedRemainingHours: number | null
  samples: number
  comparable: number
  explanation: string
  responsibleRole: string
}

export interface ForecastOverview {
  generatedAt: string
  method: string
  methodNote: string
  stages: ForecastStageStat[]
  items: ForecastItem[]
  itemsTruncated: boolean
  notes: string[]
}
