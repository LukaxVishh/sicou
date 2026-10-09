import {
  BookOpen,
  Building2,
  LayoutDashboard,
  Newspaper,
  LogOut,
  Menu,
  Users,
  Workflow,
  X,
  Home,
  ChevronRight,
  ArrowLeft,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  KeyRound,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { SystemRoles } from '../../shared/constants/roles';
import { cn } from '../../shared/utils';
import { useAuth } from '../../features/auth/providers';
import { getAreasByCompanyId } from '../../features/areas/api';
import { getCompanies } from '../../features/companies/api';
import type { CompanyArea } from '../../features/areas/types';
import { NotificationBell } from '../../features/notifications/NotificationBell';


export function AdminLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Desktop sidebar collapse state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sicou_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sicou_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;

  // Áreas da Empresa e Contexto de Navegação
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [selectedAreaContext, setSelectedAreaContext] = useState<CompanyArea | null>(null);

  // Carrega as áreas da empresa
  useEffect(() => {
    async function loadCompanyAreas() {
      try {
        let companyId = user?.companyId;
        if (!companyId && isSuperAdmin) {
          const companies = await getCompanies();
          const activeCompany = companies.find((c) => c.isActive);
          companyId = activeCompany?.id;
        }

        if (companyId) {
          const data = await getAreasByCompanyId(companyId);
          setAreas(data.filter((a) => a.isActive));
        }
      } catch {
        setAreas([]);
      }
    }

    loadCompanyAreas();
  }, [user?.companyId, isSuperAdmin]);

  // Sincroniza o contexto da área com o parâmetro areaId da URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const areaId = params.get('areaId');
    if (areaId && areas.length > 0) {
      const matchingArea = areas.find((a) => a.id === areaId);
      if (matchingArea && (!selectedAreaContext || selectedAreaContext.id !== matchingArea.id)) {
        setSelectedAreaContext(matchingArea);
      }
    } else if (!areaId && ['/app/home', '/app/dashboard', '/app/companies', '/app/users'].includes(location.pathname)) {
      setSelectedAreaContext(null);
    }
  }, [location.search, location.pathname, areas]);

  // Itens de Navegação Global
  const navigationItems = [
    {
      label: 'Recuperação de senha', path: '/app/password-recovery', icon: KeyRound,
      roles: [SystemRoles.SuperAdmin, SystemRoles.CompanyAdmin],
    },
    {
      label: 'Página Inicial',
      path: '/app/home',
      icon: Home,
      roles: [
        SystemRoles.SuperAdmin,
        SystemRoles.CompanyAdmin,
        SystemRoles.AreaAdmin,
        SystemRoles.HeadquarterUser,
        SystemRoles.UnitUser,
      ],
    },
    {
      label: 'Dashboard',
      path: '/app/dashboard',
      icon: LayoutDashboard,
      roles: [
        SystemRoles.SuperAdmin,
        SystemRoles.CompanyAdmin,
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
      label: 'Usuários & Permissões',
      path: '/app/users',
      icon: Users,
      roles: [
        SystemRoles.SuperAdmin,
        SystemRoles.CompanyAdmin,
      ],
    },
  ];

  const visibleNavigationItems = navigationItems.filter((item) => {
    if (!user) return false;
    return item.roles.some((role) => user.roles.includes(role));
  });

  const handleSelectArea = (area: CompanyArea) => {
    setSelectedAreaContext(area);
    setIsSidebarOpen(false);
    navigate(`/app/feed?areaId=${area.id}`);
  };

  const handleExitAreaContext = () => {
    setSelectedAreaContext(null);
    navigate('/app/home');
  };

  const handleNavigateAreaModule = (targetPath: string) => {
    setIsSidebarOpen(false);
    navigate(targetPath);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* SIDEBAR */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 border-r border-slate-200 bg-white transition-all duration-300 ease-in-out flex flex-col',
          isSidebarCollapsed ? 'w-20' : 'w-72',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header da Sidebar */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-slate-100 shrink-0 transition-all px-4',
            isSidebarCollapsed ? 'justify-center' : 'justify-between px-6'
          )}
        >
          {!isSidebarCollapsed ? (
            <div className="min-w-0">
              <p className="text-lg font-bold text-indigo-900 tracking-tight truncate">Sicou</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
                Governança Operacional
              </p>
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-extrabold text-base shadow-sm">
              S
            </div>
          )}

          <div className="flex items-center gap-1">
            {/* Botão de Recolher/Expandir no Desktop */}
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition"
              title={isSidebarCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu (Ampliar Espaço)'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>

            {/* Botão Fechar no Mobile */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CONTEÚDO DINÂMICO DA SIDEBAR: MODO GERAL vs MODO CONTEXTUAL DA ÁREA */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {selectedAreaContext ? (
            /* ========================================================= */
            /* MODO CONTEXTUAL: TRANSFORMADA NOS MÓDULOS DA ÁREA         */
            /* ========================================================= */
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Botão de Retorno ao Menu Geral */}
              <button
                type="button"
                onClick={handleExitAreaContext}
                className={cn(
                  'w-full flex items-center gap-2 rounded-xl transition-all border border-slate-200 bg-white shadow-xs hover:text-indigo-600 hover:bg-indigo-50',
                  isSidebarCollapsed
                    ? 'justify-center p-2.5 text-slate-600'
                    : 'px-3 py-2 text-xs font-bold text-slate-600'
                )}
                title="Voltar ao Menu Geral"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-600 shrink-0" />
                {!isSidebarCollapsed && <span>Voltar ao Menu Geral</span>}
              </button>

              {/* Card Destaque da Área */}
              <div
                className={cn(
                  'bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100/80 shadow-xs transition-all',
                  isSidebarCollapsed ? 'p-2 flex flex-col items-center justify-center' : 'p-3.5 space-y-1.5'
                )}
                title={selectedAreaContext.name}
              >
                <div className={cn('flex items-center gap-2', isSidebarCollapsed ? 'justify-center' : '')}>
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                        Área da Sede
                      </span>
                      <h3 className="text-xs font-bold text-slate-800 leading-tight truncate">
                        {selectedAreaContext.name}
                      </h3>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && selectedAreaContext.description && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 pt-1 border-t border-indigo-100/50">
                    {selectedAreaContext.description}
                  </p>
                )}
              </div>

              {/* Lista dos Módulos da Área */}
              <div className="space-y-1">
                {selectedAreaContext.modules.some(module => module.code === 'Guide' && module.enabled) && <button
                  onClick={() => handleNavigateAreaModule(`/app/guide?areaId=${selectedAreaContext.id}`)}
                  className={cn('w-full flex items-center rounded-xl text-xs font-semibold transition-all',
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5',
                    location.pathname === '/app/guide' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600')}
                  title="Orientador"
                ><div className="flex items-center gap-2.5"><BookOpen className="w-4 h-4 shrink-0" />{!isSidebarCollapsed && <span>Orientador</span>}</div>
                  {!isSidebarCollapsed && <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />}
                </button>}
                {!isSidebarCollapsed && (
                  <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Módulos desta Área
                  </p>
                )}

                {/* 1. Workflows & Processos da Área */}
                <button
                  onClick={() => handleNavigateAreaModule(`/app/workflows?areaId=${selectedAreaContext.id}`)}
                  className={cn(
                    'w-full flex items-center rounded-xl text-xs font-semibold transition-all',
                    isSidebarCollapsed
                      ? 'justify-center p-2.5'
                      : 'justify-between px-3 py-2.5',
                    location.pathname === '/app/workflows' && location.search.includes(selectedAreaContext.id)
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  )}
                  title="Workflows & Processos"
                >
                  <div className="flex items-center gap-2.5">
                    <Workflow className="w-4 h-4 shrink-0" />
                    {!isSidebarCollapsed && <span>Workflows & Processos</span>}
                  </div>
                  {!isSidebarCollapsed && <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />}
                </button>

                {/* 2. Feed & Comunicados da Área */}
                <button
                  onClick={() => handleNavigateAreaModule(`/app/feed?areaId=${selectedAreaContext.id}`)}
                  className={cn(
                    'w-full flex items-center rounded-xl text-xs font-semibold transition-all',
                    isSidebarCollapsed
                      ? 'justify-center p-2.5'
                      : 'justify-between px-3 py-2.5',
                    location.pathname === '/app/feed' && location.search.includes(selectedAreaContext.id)
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                  )}
                  title="Comunicados & Feed"
                >
                  <div className="flex items-center gap-2.5">
                    <Newspaper className="w-4 h-4 shrink-0" />
                    {!isSidebarCollapsed && <span>Comunicados & Feed</span>}
                  </div>
                  {!isSidebarCollapsed && <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />}
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* MODO GERAL: NAVEGAÇÃO COMPLETA + LISTA DE ÁREAS           */
            /* ========================================================= */
            <>
              {/* Menu Principal */}
              <nav className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Navegação Principal
                  </p>
                )}

                {visibleNavigationItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      title={item.label}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center rounded-xl text-xs font-semibold transition-all',
                          isSidebarCollapsed
                            ? 'justify-center p-2.5'
                            : 'gap-3 px-3 py-2.5',
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </nav>

              {/* Seção Áreas da Empresa */}
              {areas.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {!isSidebarCollapsed ? (
                    <div className="px-3 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Áreas da Sede
                      </p>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                        {areas.length}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-center pb-1">
                      <span className="h-1 w-6 rounded-full bg-slate-200" />
                    </div>
                  )}

                  <div className="space-y-1">
                    {areas.map((area) => (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => handleSelectArea(area)}
                        className={cn(
                          'w-full flex items-center rounded-xl text-xs font-medium text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/80 transition-all group border border-transparent hover:border-indigo-100',
                          isSidebarCollapsed
                            ? 'justify-center p-2'
                            : 'justify-between px-3 py-2 text-left'
                        )}
                        title={`Navegar nos módulos de ${area.name}`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="p-1 rounded-md bg-slate-100 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <FolderTree className="w-3.5 h-3.5" />
                          </span>
                          {!isSidebarCollapsed && <span className="truncate">{area.name}</span>}
                        </div>
                        {!isSidebarCollapsed && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <div
            className={cn(
              'flex items-center bg-slate-50 rounded-2xl border border-slate-200/60 transition-all',
              isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 p-2.5'
            )}
            title={`${user?.fullName} (${user?.roles[0] || 'Usuário'})`}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.roles[0] || 'Usuário'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay Backdrop para Mobile */}
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Fechar menu lateral"
        />
      )}

      {/* MAIN CONTENT WRAPPER */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-300 ease-in-out',
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Botão Mobile */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Botão Desktop para Recolher / Expandir Menu Lateral */}
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex items-center justify-center rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition border border-slate-200 shadow-2xs"
              title={isSidebarCollapsed ? 'Expandir Menu Lateral' : 'Recolher Menu Lateral (Modo Espaço Amplo)'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedAreaContext ? `Contexto: ${selectedAreaContext.name}` : 'Ambiente Corporativo'}
              </p>
              <p className="text-xs text-slate-500">
                {selectedAreaContext ? 'Navegando nos módulos específicos da área' : 'Sicou Governança Operacional'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
