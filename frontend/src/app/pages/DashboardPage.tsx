import {
  ArrowRight,
  Building,
  Building2,
  Globe,
  Layers3,
  RefreshCcw,
  ShieldCheck,
  Users,
  Workflow,
  ExternalLink,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../features/auth/providers';
import { SystemRoles } from '../../shared/constants/roles';
import { apiFetch } from '../../shared/api';
import { getCompanies } from '../../features/companies/api';
import type { Company } from '../../features/companies/types';
import { getUsers } from '../../features/users/api';
import type { User } from '../../features/users/types';
import { FeedSummary } from '../../features/posts';
import { useAdminViewContext } from '../layouts/AdminLayout';
import { SystemLoadingState } from '../../shared/components';

type CatalogOptionsResponse = {
  companies: { id: string; name: string }[];
  areas: { id: string; name: string; companyId?: string | null }[];
  units: { id: string; name: string; companyId?: string | null }[];
};

export function DashboardPage() {
  const { user } = useAuth();
  const adminContext = useAdminViewContext();

  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;
  const isCompanyAdmin = user?.roles.includes(SystemRoles.CompanyAdmin) ?? false;

  // Contexto de empresa ativa (Super Admin com seleção ou Admin de Empresa)
  const activeCompanyId = adminContext?.selectedCompanyId || (isCompanyAdmin ? user?.companyId : '') || '';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (isSilent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [companiesData, usersData, catalogData] = await Promise.all([
        getCompanies().catch(() => [] as Company[]),
        getUsers().catch(() => [] as User[]),
        apiFetch<CatalogOptionsResponse>('/api/reports/catalog/options').catch(() => null),
      ]);

      setCompanies(companiesData);
      setUsers(usersData);
      setCatalogOptions(catalogData);
    } catch {
      // Falha silenciosa com dados vazios
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  // Identifica a empresa ativa no contexto
  const activeCompany = useMemo(() => {
    if (!activeCompanyId) return null;
    return companies.find((c) => c.id === activeCompanyId) || null;
  }, [companies, activeCompanyId]);

  // Mapeamento de contagens por empresa
  const companyMetricsMap = useMemo(() => {
    const map = new Map<string, { usersCount: number; unitsCount: number; areasCount: number }>();

    companies.forEach((c) => {
      map.set(c.id, { usersCount: 0, unitsCount: 0, areasCount: 0 });
    });

    // Contagem de usuários
    users.forEach((u) => {
      if (u.companyId && map.has(u.companyId)) {
        const current = map.get(u.companyId)!;
        current.usersCount += 1;
      }
    });

    // Contagem de unidades do catálogo
    catalogOptions?.units.forEach((u) => {
      if (u.companyId && map.has(u.companyId)) {
        const current = map.get(u.companyId)!;
        current.unitsCount += 1;
      }
    });

    // Contagem de áreas da sede do catálogo
    catalogOptions?.areas.forEach((a) => {
      if (a.companyId && map.has(a.companyId)) {
        const current = map.get(a.companyId)!;
        current.areasCount += 1;
      }
    });

    return map;
  }, [companies, users, catalogOptions]);

  // Contagens globais da plataforma
  const totalCompaniesCount = companies.length;
  const activeCompaniesCount = companies.filter((c) => c.isActive).length;
  const inactiveCompaniesCount = totalCompaniesCount - activeCompaniesCount;

  const totalUsersCount = users.length;
  const platformAdminsCount = users.filter((u) => u.roles.includes('SUPER_ADMIN') || !u.companyId).length;
  const companyUsersCount = totalUsersCount - platformAdminsCount;

  const totalUnitsCount = catalogOptions?.units.length ?? 0;
  const totalAreasCount = catalogOptions?.areas.length ?? 0;

  // Se estiver escopado a uma empresa específica
  const isCompanyScoped = Boolean(activeCompanyId);

  // Métricas específicas da empresa ativa
  const scopedMetrics = useMemo(() => {
    if (!activeCompanyId) return null;
    const data = companyMetricsMap.get(activeCompanyId);
    return {
      usersCount: data?.usersCount ?? users.filter((u) => u.companyId === activeCompanyId).length,
      unitsCount: data?.unitsCount ?? 0,
      areasCount: data?.areasCount ?? 0,
    };
  }, [activeCompanyId, companyMetricsMap, users]);

  // Ação para o Super Admin ativar uma empresa a partir do Dashboard
  const handleActivateCompanyView = (companyId: string) => {
    adminContext?.setSelectedCompanyId(companyId);
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-7">
      {/* CABEÇALHO DO DASHBOARD */}
      <header className="relative isolate overflow-hidden rounded-3xl bg-slate-900 px-6 py-7 text-white shadow-xl shadow-slate-950/15 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-16 -top-36 -z-10 h-80 w-80 rounded-full border-[44px] border-white/[0.04]" />
        <div aria-hidden="true" className="absolute -bottom-40 right-56 -z-10 h-64 w-64 rounded-full border-[36px] border-white/[0.035]" />

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
                <Layers3 className="h-3.5 w-3.5" />
                {isCompanyScoped
                  ? `Painel Corporativo · ${activeCompany?.name || 'Empresa'}`
                  : 'Painel Gerencial da Plataforma Sicou'}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {isCompanyScoped
                ? `Visão Gerencial · ${activeCompany?.name || 'Minha Empresa'}`
                : 'Painel Gerencial do Sistema'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {isCompanyScoped
                ? `Acompanhe os indicadores corporativos, colaboradores e áreas da sede de ${activeCompany?.name || 'sua organização'}.`
                : 'Visão consolidada de utilização, empresas conveniadas, colaboradores ativos e governança de todo o sistema.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Se o Super Admin estiver com uma empresa ativa, exibe botão para retornar para a visão global */}
            {isSuperAdmin && isCompanyScoped && (
              <button
                type="button"
                onClick={() => adminContext?.setSelectedCompanyId('')}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white shadow-xs backdrop-blur-sm transition hover:bg-white/20"
              >
                <Globe className="h-4 w-4 text-indigo-300" />
                <span>Voltar à Visão Global do Sistema</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadDashboardData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-300' : ''}`} />
              Atualizar dados
            </button>
          </div>
        </div>
      </header>

      {/* ESTADO DE CARREGAMENTO */}
      {isLoading ? (
        <SystemLoadingState label="Carregando indicadores gerenciais..." />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* MODO 1: VISÃO GLOBAL DO SISTEMA (Super Admin sem empresa selecionada)      */}
          {/* ========================================================================= */}
          {!isCompanyScoped ? (
            <div className="space-y-7">
              {/* CARDS DE INDICADORES GLOBAIS DA PLATAFORMA */}
              <section aria-label="Indicadores da Plataforma">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {/* Card 1: Empresas Cadastradas */}
                  <Link
                    to="/app/companies"
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100">
                          <Building2 className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Empresas
                          </p>
                          <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                            {totalCompaniesCount}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {activeCompaniesCount} ativas
                      </span>
                      {inactiveCompaniesCount > 0 && (
                        <span>· {inactiveCompaniesCount} inativas</span>
                      )}
                    </div>
                  </Link>

                  {/* Card 2: Colaboradores no Sistema */}
                  <Link
                    to="/app/users"
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100">
                          <Users className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Colaboradores
                          </p>
                          <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                            {totalUsersCount}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-indigo-600">
                        {platformAdminsCount} admins Sicou
                      </span>
                      <span>· {companyUsersCount} em empresas</span>
                    </div>
                  </Link>

                  {/* Card 3: Unidades & Filiais */}
                  <Link
                    to="/app/reports"
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                          <Building className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Unidades Operacionais
                          </p>
                          <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                            {totalUnitsCount}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      <span>Filiais ativas em todas as empresas</span>
                    </div>
                  </Link>

                  {/* Card 4: Áreas da Sede */}
                  <Link
                    to="/app/companies"
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
                          <Workflow className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Áreas da Sede
                          </p>
                          <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                            {totalAreasCount}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      <span>Departamentos com Orientador e Workflows</span>
                    </div>
                  </Link>
                </div>
              </section>

              {/* TABELA GERENCIAL DE USO DAS EMPRESAS */}
              <section aria-label="Utilização por Empresa" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 bg-slate-50/50">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">
                      Estrutura &amp; Utilização por Empresa
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Acompanhamento gerencial do volume de colaboradores, unidades e áreas ativas de cada organização.
                    </p>
                  </div>
                  <Link
                    to="/app/companies"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                  >
                    <span>Diretório Geral de Empresas</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1000px] w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Empresa Conveniada
                        </th>
                        <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Situação
                        </th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Colaboradores
                        </th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Unidades
                        </th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Áreas da Sede
                        </th>
                        <th className="px-6 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Ações do Painel
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {companies.map((company) => {
                        const metrics = companyMetricsMap.get(company.id) || {
                          usersCount: 0,
                          unitsCount: 0,
                          areasCount: 0,
                        };

                        return (
                          <tr key={company.id} className="transition-colors hover:bg-indigo-50/25">
                            {/* Nome e Documento */}
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-sm ring-1 ring-slate-200">
                                  {company.name.charAt(0).toUpperCase()}
                                </span>
                                <div>
                                  <Link
                                    to={`/app/companies/${company.id}`}
                                    className="font-bold text-sm text-slate-900 hover:text-indigo-600 transition"
                                  >
                                    {company.name}
                                  </Link>
                                  <p className="text-xs text-slate-400 font-mono">
                                    {company.document || 'Sem CNPJ informado'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Situação */}
                            <td className="whitespace-nowrap px-6 py-4">
                              {company.isActive ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Ativa
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                                  Inativa
                                </span>
                              )}
                            </td>

                            {/* Colaboradores */}
                            <td className="whitespace-nowrap px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">
                                {metrics.usersCount} colaboradores
                              </span>
                            </td>

                            {/* Unidades */}
                            <td className="whitespace-nowrap px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                {metrics.unitsCount} unidades
                              </span>
                            </td>

                            {/* Áreas */}
                            <td className="whitespace-nowrap px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                {metrics.areasCount} áreas
                              </span>
                            </td>

                            {/* Ações */}
                            <td className="whitespace-nowrap px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleActivateCompanyView(company.id)}
                                  title="Carregar ambiente e áreas desta empresa no menu lateral"
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span>Ativar ambiente</span>
                                </button>
                                <Link
                                  to={`/app/companies/${company.id}`}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                >
                                  Gerenciar
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ATALHOS RÁPIDOS DA PLATAFORMA */}
              <section aria-labelledby="shortcuts-heading" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="shortcuts-heading" className="text-base font-bold text-slate-900">
                      Gestão &amp; Governança da Plataforma
                    </h2>
                    <p className="text-xs text-slate-500">
                      Acesso rápido aos painéis de administração corporativa do Sicou.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Link
                    to="/app/companies"
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Administração de Empresas</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Cadastre novas empresas, gerencie unidades e acompanhe as áreas da sede.
                      </p>
                    </div>
                  </Link>

                  <Link
                    to="/app/users"
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                      <Users className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Usuários &amp; Permissões</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Super admins da plataforma, colaboradores por empresa e lotações operacionais.
                      </p>
                    </div>
                  </Link>

                  <Link
                    to="/app/reports"
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Relatórios Consolidados</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Emissão de relatórios em PDF, XLSX e CSV para processos, usuários e unidades.
                      </p>
                    </div>
                  </Link>
                </div>
              </section>
            </div>
          ) : (
            /* ========================================================================= */
            /* MODO 2: VISÃO ESPECÍFICA DA EMPRESA (Company Admin ou Super Admin ativo) */
            /* ========================================================================= */
            <div className="space-y-7">
              {/* INDICADORES DA EMPRESA ATIVA */}
              <section aria-label="Indicadores da Empresa">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {/* Card 1: Colaboradores da Empresa */}
                  <Link
                    to="/app/users"
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100">
                          <Users className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Colaboradores
                          </p>
                          <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                            {scopedMetrics?.usersCount ?? 0}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      <span>Equipe vinculada a {activeCompany?.name}</span>
                    </div>
                  </Link>

                  {/* Card 2: Áreas da Sede */}
                  <Link
                    to={`/app/companies/${activeCompanyId}?tab=areas`}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
                          <Workflow className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Áreas da Sede
                          </p>
                          <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                            {scopedMetrics?.areasCount ?? 0}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      <span>Departamentos com módulos na barra lateral</span>
                    </div>
                  </Link>

                  {/* Card 3: Unidades Operacionais */}
                  <Link
                    to={`/app/companies/${activeCompanyId}?tab=units`}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                          <Building className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Unidades / Filiais
                          </p>
                          <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                            {scopedMetrics?.unitsCount ?? 0}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      <span>Unidades ativas na organização</span>
                    </div>
                  </Link>
                </div>
              </section>

              {/* ATALHOS RÁPIDOS DA EMPRESA E FEED */}
              <div className="grid items-start gap-6 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-8">
                  <FeedSummary />
                </div>

                <div className="space-y-4 xl:col-span-4">
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-bold text-sm text-slate-900 mb-3">
                      Ações Rápidas de Governança
                    </h3>
                    <div className="space-y-2">
                      <Link
                        to={`/app/companies/${activeCompanyId}?tab=areas`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 transition"
                      >
                        <span>Gerenciar Áreas da Sede</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>

                      <Link
                        to="/app/users"
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 transition"
                      >
                        <span>Colaboradores &amp; Acessos</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>

                      <Link
                        to="/app/reports"
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 transition"
                      >
                        <span>Relatórios Operacionais</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
