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
import { MasterDataPage } from '../features/admin/master/MasterDataPage'
import { AuditTrailPage } from '../features/admin/users/AuditTrailPage'
import { LoginHistoryPage } from '../features/admin/users/LoginHistoryPage'
import { RolesPage } from '../features/admin/users/RolesPage'
import { UsersPage } from '../features/admin/users/UsersPage'
import { RoadmapPage } from '../features/roadmap/RoadmapPage'
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

          <Route path="notifications" element={<NotificationListPage />} />

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
          <Route path="roadmap" element={<Navigate to="/roadmap/land-records" replace />} />
          <Route path="roadmap/:module" element={<RoadmapPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
