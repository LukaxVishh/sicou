import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from '../layouts';
import { ComingSoonPage, DashboardPage } from '../pages';
import { LoginPage } from '../../features/auth/pages';
import { ProtectedRoute } from './ProtectedRoute';
import {
  CompaniesPage,
  CompanyDetailsPage,
} from '../../features/companies/pages';
import { UsersPage } from '../../features/users';
import { FeedPage } from '../../features/posts';


export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/app/dashboard" replace />}
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
              element={<Navigate to="/app/dashboard" replace />}
            />

            <Route
              path="dashboard"
              element={<DashboardPage />}
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
              path="access-control"
              element={(
                <ComingSoonPage
                  title="Permissões"
                  description="Nesta área vamos construir a gestão de acessos granulares por empresa, unidade e área."
                />
              )}
            />
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to="/app/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}