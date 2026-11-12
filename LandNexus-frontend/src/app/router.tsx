import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { LoginPage } from '../features/auth/LoginPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { RequirePermission } from '../features/auth/RequirePermission'
import { NoAccessPage } from '../features/auth/NoAccessPage'
import { MyWorkPage } from '../features/myWork/MyWorkPage'
import { NotificationListPage } from '../features/notifications/NotificationListPage'
import { ProjectDetailsPage } from '../features/projects/ProjectDetailsPage'
import { ProjectListPage } from '../features/projects/ProjectListPage'
import { ProposalDetailsPage } from '../features/proposals/ProposalDetailsPage'
import { ProposalFormPage } from '../features/proposals/ProposalFormPage'
import { ProposalListPage } from '../features/proposals/ProposalListPage'
import { NotFoundPage } from '../features/shared/NotFoundPage'
import { GisMapPage } from '../features/gis/GisMapPage'
import { ConflictWorkspacePage } from '../features/gis/ConflictWorkspacePage'
import { VillageParcelsPage } from '../features/gis/VillageParcelsPage'
import { CaseDetailsPage } from '../features/acquisition/CaseDetailsPage'
import { CaseFormPage } from '../features/acquisition/CaseFormPage'
import { CaseListPage } from '../features/acquisition/CaseListPage'
import { AwardPrintPage } from '../features/acquisition/AwardPrintPage'
import { MySurveysPage } from '../features/acquisition/MySurveysPage'
import { NoticePrintPage } from '../features/acquisition/NoticePrintPage'
import { NoticesRegisterPage } from '../features/acquisition/NoticesRegisterPage'
import { SurveyFormPage } from '../features/acquisition/SurveyFormPage'
import { BenefitCataloguePage } from '../features/compensation/BenefitCataloguePage'
import { RateRulesPage } from '../features/compensation/RateRulesPage'
import { RrCaseDetailPage } from '../features/compensation/RrCaseDetailPage'
import { RuleSetDetailPage } from '../features/compensation/RuleSetDetailPage'
import { ValuationDetailPage } from '../features/compensation/ValuationDetailPage'
import { LandownerListPage } from '../features/landRecords/LandownerListPage'
import { DocumentDetailsPage } from '../features/landRecords/DocumentDetailsPage'
import { DocumentRegisterPage } from '../features/landRecords/DocumentRegisterPage'
import { ParcelDetailsPage } from '../features/landRecords/ParcelDetailsPage'
import { ParcelFormPage } from '../features/landRecords/ParcelFormPage'
import { ParcelListPage } from '../features/landRecords/ParcelListPage'
import { MasterDataPage } from '../features/admin/master/MasterDataPage'
import { AuditTrailPage } from '../features/admin/users/AuditTrailPage'
import { LoginHistoryPage } from '../features/admin/users/LoginHistoryPage'
import { RolesPage } from '../features/admin/users/RolesPage'
import { UsersPage } from '../features/admin/users/UsersPage'
import { RoadmapPage } from '../features/roadmap/RoadmapPage'
import { DashboardPage } from '../features/monitoring/DashboardPage'
import { ProjectMonitoringPage } from '../features/monitoring/ProjectMonitoringPage'
import { NlamsPanel } from '../features/monitoring/NlamsPanel'
import { GeographyMonitoringPage } from '../features/monitoring/GeographyMonitoringPage'
import { LifecycleMonitoringPage } from '../features/monitoring/LifecycleMonitoringPage'
import { CompensationMonitoringPage } from '../features/monitoring/CompensationMonitoringPage'
import { MisReportsPage } from '../features/monitoring/MisReportsPage'
import { SlaMonitoringPage } from '../features/monitoring/SlaMonitoringPage'
import { PERMISSION, PROPOSAL_READ_ANY } from '../utils/permissions'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<MyWorkPage />} />

          <Route
            path="proposals"
            element={
              <RequirePermission any={[...PROPOSAL_READ_ANY]}>
                <ProposalListPage />
              </RequirePermission>
            }
          />

          <Route
            path="proposals/new"
            element={
              <RequirePermission any={[PERMISSION.PROPOSAL_CREATE]}>
                <ProposalFormPage />
              </RequirePermission>
            }
          />

          <Route
            path="proposals/:id"
            element={
              <RequirePermission any={[...PROPOSAL_READ_ANY]}>
                <ProposalDetailsPage />
              </RequirePermission>
            }
          />

          <Route
            path="proposals/:id/edit"
            element={
              <RequirePermission any={[PERMISSION.PROPOSAL_CREATE]}>
                <ProposalFormPage />
              </RequirePermission>
            }
          />

          <Route
            path="projects"
            element={
              <RequirePermission any={[...PROPOSAL_READ_ANY]}>
                <ProjectListPage />
              </RequirePermission>
            }
          />

          <Route
            path="projects/:id"
            element={
              <RequirePermission any={[...PROPOSAL_READ_ANY]}>
                <ProjectDetailsPage />
              </RequirePermission>
            }
          />

          <Route
            path="gis"
            element={
              <RequirePermission any={[PERMISSION.MASTER_DATA_READ]}>
                <GisMapPage />
              </RequirePermission>
            }
          />

          <Route
            path="gis/conflicts"
            element={
              <RequirePermission any={[PERMISSION.GIS_READ]}>
                <ConflictWorkspacePage />
              </RequirePermission>
            }
          />

          <Route
            path="gis/villages"
            element={
              <RequirePermission any={[PERMISSION.GIS_READ]}>
                <VillageParcelsPage />
              </RequirePermission>
            }
          />

          <Route
            path="land/parcels"
            element={
              <RequirePermission any={[PERMISSION.LAND_RECORD_READ]}>
                <ParcelListPage />
              </RequirePermission>
            }
          />

          <Route
            path="land/parcels/new"
            element={
              <RequirePermission any={[PERMISSION.LAND_RECORD_WRITE]}>
                <ParcelFormPage />
              </RequirePermission>
            }
          />

          <Route
            path="land/parcels/:id"
            element={
              <RequirePermission any={[PERMISSION.LAND_RECORD_READ]}>
                <ParcelDetailsPage />
              </RequirePermission>
            }
          />

          <Route
            path="land/parcels/:id/edit"
            element={
              <RequirePermission any={[PERMISSION.LAND_RECORD_WRITE]}>
                <ParcelFormPage />
              </RequirePermission>
            }
          />

          <Route
            path="land/landowners"
            element={
              <RequirePermission any={[PERMISSION.LANDOWNER_READ]}>
                <LandownerListPage />
              </RequirePermission>
            }
          />

          <Route
            path="land/documents"
            element={
              <RequirePermission any={[PERMISSION.LAND_RECORD_READ]}>
                <DocumentRegisterPage />
              </RequirePermission>
            }
          />

          <Route
            path="land/documents/:id"
            element={
              <RequirePermission any={[PERMISSION.DOCUMENT_READ]}>
                <DocumentDetailsPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition"
            element={
              <RequirePermission any={[PERMISSION.ACQUISITION_READ]}>
                <CaseListPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition/new"
            element={
              <RequirePermission any={[PERMISSION.ACQUISITION_MANAGE]}>
                <CaseFormPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition/my-surveys"
            element={
              <RequirePermission any={[PERMISSION.SURVEY_PERFORM]}>
                <MySurveysPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition/notices"
            element={
              <RequirePermission any={[PERMISSION.ACQUISITION_READ]}>
                <NoticesRegisterPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition/notices/:caseId/:noticeId"
            element={
              <RequirePermission any={[PERMISSION.ACQUISITION_READ]}>
                <NoticePrintPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition/:id/surveys/:caseParcelId/new"
            element={
              <RequirePermission any={[PERMISSION.SURVEY_PERFORM]}>
                <SurveyFormPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition/:id/award/print"
            element={
              <RequirePermission any={[PERMISSION.ACQUISITION_READ]}>
                <AwardPrintPage />
              </RequirePermission>
            }
          />

          <Route
            path="acquisition/:id"
            element={
              <RequirePermission any={[PERMISSION.ACQUISITION_READ]}>
                <CaseDetailsPage />
              </RequirePermission>
            }
          />

          <Route
            path="compensation/rules"
            element={
              <RequirePermission any={[PERMISSION.VALUATION_READ]}>
                <RateRulesPage />
              </RequirePermission>
            }
          />

          <Route
            path="compensation/rr/benefits"
            element={
              <RequirePermission any={[PERMISSION.RR_CATALOGUE]}>
                <BenefitCataloguePage />
              </RequirePermission>
            }
          />

          <Route
            path="compensation/valuations/:id"
            element={
              <RequirePermission any={[PERMISSION.VALUATION_READ]}>
                <ValuationDetailPage />
              </RequirePermission>
            }
          />

          <Route
            path="compensation/rr-cases/:id"
            element={
              <RequirePermission any={[PERMISSION.RR_READ]}>
                <RrCaseDetailPage />
              </RequirePermission>
            }
          />

          <Route
            path="compensation/rule-sets/:id"
            element={
              <RequirePermission any={[PERMISSION.VALUATION_READ]}>
                <RuleSetDetailPage />
              </RequirePermission>
            }
          />

          <Route path="notifications" element={<NotificationListPage />} />

          <Route
            path="monitoring"
            element={
              <RequirePermission any={[PERMISSION.DASHBOARD_READ]}>
                <DashboardPage />
              </RequirePermission>
            }
          />

          <Route
            path="monitoring/projects"
            element={
              <RequirePermission any={[PERMISSION.DASHBOARD_READ]}>
                <ProjectMonitoringPage />
              </RequirePermission>
            }
          />

          <Route
            path="monitoring/nlams"
            element={
              <RequirePermission any={[PERMISSION.DASHBOARD_READ]}>
                <NlamsPanel />
              </RequirePermission>
            }
          />

          <Route
            path="monitoring/geography"
            element={
              <RequirePermission any={[PERMISSION.DASHBOARD_READ]}>
                <GeographyMonitoringPage />
              </RequirePermission>
            }
          />

          <Route
            path="monitoring/lifecycle"
            element={
              <RequirePermission any={[PERMISSION.DASHBOARD_READ]}>
                <LifecycleMonitoringPage />
              </RequirePermission>
            }
          />

          <Route
            path="monitoring/compensation"
            element={
              <RequirePermission any={[PERMISSION.DASHBOARD_READ]}>
                <CompensationMonitoringPage />
              </RequirePermission>
            }
          />

          <Route
            path="monitoring/reports"
            element={
              <RequirePermission any={[PERMISSION.REPORT_READ]}>
                <MisReportsPage />
              </RequirePermission>
            }
          />

          <Route
            path="monitoring/sla"
            element={
              <RequirePermission any={[PERMISSION.SLA_READ]}>
                <SlaMonitoringPage />
              </RequirePermission>
            }
          />

          <Route path="admin" element={<Navigate to="/admin/master/ministries" replace />} />

          <Route
            path="admin/master/:resource"
            element={
              <RequirePermission any={[PERMISSION.MASTER_DATA_READ]}>
                <MasterDataPage />
              </RequirePermission>
            }
          />

          <Route
            path="admin/users"
            element={
              <RequirePermission any={[PERMISSION.USER_READ]}>
                <UsersPage />
              </RequirePermission>
            }
          />

          <Route
            path="admin/roles"
            element={
              <RequirePermission any={[PERMISSION.USER_READ]}>
                <RolesPage />
              </RequirePermission>
            }
          />

          <Route
            path="admin/audit"
            element={
              <RequirePermission any={[PERMISSION.AUDIT_READ]}>
                <AuditTrailPage />
              </RequirePermission>
            }
          />

          <Route
            path="admin/logins"
            element={
              <RequirePermission any={[PERMISSION.AUDIT_READ]}>
                <LoginHistoryPage />
              </RequirePermission>
            }
          />

          <Route path="404" element={<NotFoundPage />} />
          <Route path="403" element={<NoAccessPage />} />
          <Route
            path="roadmap"
            element={<Navigate to="/roadmap/valuation-compensation" replace />}
          />
          <Route path="roadmap/gis" element={<Navigate to="/gis" replace />} />
          <Route path="roadmap/:module" element={<RoadmapPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
