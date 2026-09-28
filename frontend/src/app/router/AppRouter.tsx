import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from '../layouts';
import { DashboardPage, HomePage } from '../pages';
import { LoginPage } from '../../features/auth/pages';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../../features/auth/providers';
import { SystemRoles } from '../../shared/constants/roles';
import {
  CompaniesPage,
  CompanyDetailsPage,
} from '../../features/companies/pages';
import { UsersPage, UserDetailsPage } from '../../features/users';
import { FeedPage } from '../../features/posts';
import {
  WorkflowsPage,
  FieldEditorPage,
  ProcessNodeEditorPage,
  ProcessTreeBuilderPage,
  ProcessConfectionPage,
} from '../../features/workflows';

function IndexRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.roles.includes(SystemRoles.SuperAdmin) || user.roles.includes(SystemRoles.CompanyAdmin);
  return <Navigate to={isAdmin ? "/app/dashboard" : "/app/home"} replace />;
}

function DashboardRouteGuard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.roles.includes(SystemRoles.SuperAdmin) || user.roles.includes(SystemRoles.CompanyAdmin);
  if (!isAdmin) {
    return <Navigate to="/app/home" replace />;
  }
  return <DashboardPage />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<IndexRedirect />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/app"
            element={<AdminLayout />}
          >
            <Route
              index
              element={<IndexRedirect />}
            />

            <Route
              path="home"
              element={<HomePage />}
            />

            <Route
              path="dashboard"
              element={<DashboardRouteGuard />}
            />

            <Route
              path="feed"
              element={<FeedPage />}
            />

            <Route
              path="companies"
              element={<CompaniesPage />}
            />

            <Route
              path="companies/:companyId"
              element={<CompanyDetailsPage />}
            />

            <Route
              path="users"
              element={<UsersPage />}
            />

            <Route
              path="users/:userId"
              element={<UserDetailsPage />}
            />

            <Route
              path="access-control"
              element={<Navigate to="/app/users" replace />}
            />

            <Route
              path="workflows"
              element={<WorkflowsPage />}
            />

            <Route
              path="workflows/fields/new"
              element={<FieldEditorPage />}
            />

            <Route
              path="workflows/fields/:fieldId"
              element={<FieldEditorPage />}
            />

            <Route
              path="workflows/nodes/new"
              element={<ProcessNodeEditorPage />}
            />

            <Route
              path="workflows/nodes/:nodeId"
              element={<ProcessNodeEditorPage />}
            />

            <Route
              path="workflows/trees/new"
              element={<ProcessTreeBuilderPage />}
            />

            <Route
              path="workflows/trees/:treeId"
              element={<ProcessTreeBuilderPage />}
            />

            <Route
              path="workflows/processes/:id/confection"
              element={<ProcessConfectionPage />}
            />
          </Route>
        </Route>

        <Route
          path="*"
          element={<IndexRedirect />}
        />
      </Routes>
    </BrowserRouter>
  );
}