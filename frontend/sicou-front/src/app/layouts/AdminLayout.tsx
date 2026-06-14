import {
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { SystemRoles } from '../../shared/constants/roles';
import { cn } from '../../shared/utils';
import { useAuth } from '../../features/auth/providers';

const navigationItems = [
  {
    label: 'Dashboard',
    path: '/app/dashboard',
    icon: LayoutDashboard,
    roles: [
      SystemRoles.SuperAdmin,
      SystemRoles.CompanyAdmin,
      SystemRoles.AreaAdmin,
      SystemRoles.HeadquarterUser,
      SystemRoles.UnitUser,
    ],
  },
  {
    label: 'Empresas',
    path: '/app/companies',
    icon: Building2,
    roles: [
      SystemRoles.SuperAdmin,
    ],
  },
  {
    label: 'Usuários',
    path: '/app/users',
    icon: Users,
    roles: [
      SystemRoles.SuperAdmin,
      SystemRoles.CompanyAdmin,
    ],
  },
  {
    label: 'Permissões',
    path: '/app/access-control',
    icon: ShieldCheck,
    roles: [
      SystemRoles.SuperAdmin,
      SystemRoles.CompanyAdmin,
    ],
  },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const visibleNavigationItems = navigationItems.filter((item) => {
    if (!user) {
      return false;
    }

    return item.roles.some((role) => user.roles.includes(role));
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition-transform lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <div>
            <p className="text-lg font-bold text-slate-900">Sicou</p>
            <p className="text-xs text-slate-500">Governança operacional</p>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-4">
          {visibleNavigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Fechar menu lateral"
        />
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Ambiente administrativo
              </p>
              <p className="text-xs text-slate-500">
                Backend integrado em desenvolvimento local
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">
                {user?.fullName}
              </p>
              <p className="text-xs text-slate-500">
                {user?.roles.join(', ')}
              </p>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}