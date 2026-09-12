import {
  ArrowLeft,
  BookOpen,
  FileText,
  Layers3,
  LayoutDashboard,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CompanyAreasSection } from '../../areas';
import { CompanyUnitsSection } from '../../units/components';
import { getCompanyById } from '../api';
import type { Company } from '../types';
import { getUnitsByCompanyId } from '../../units/api';
import type { Unit } from '../../units/types';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import { getUsers } from '../../users/api';
import type { User } from '../../users/types';
import { getAccessesByCompany } from '../../access-control/api';
import type { UserAreaAccess } from '../../access-control/types';
import { getPosts } from '../../posts/api';
import type { Post } from '../../posts/types';
import {
  CompanyAccessControlSection,
  CompanyFeedSection,
  CompanyGuideSection,
  CompanyOverviewTab,
  CompanyUsersSection,
} from '../components';

type TabId =
  | 'overview'
  | 'areas'
  | 'units'
  | 'users'
  | 'access-control'
  | 'feed'
  | 'guide';

function formatDate(value?: string | null) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function CompanyDetailsPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [company, setCompany] = useState<Company | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accesses, setAccesses] = useState<UserAreaAccess[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const [isLoading, setIsLoading] = useState(Boolean(companyId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAllCompanyData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!companyId) return;

      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const [compData, unitsData, areasData, allUsersData, accessData, postsData] =
          await Promise.all([
            getCompanyById(companyId),
            getUnitsByCompanyId(companyId).catch(() => [] as Unit[]),
            getAreasByCompanyId(companyId).catch(() => [] as CompanyArea[]),
            getUsers().catch(() => [] as User[]),
            getAccessesByCompany(companyId).catch(() => [] as UserAreaAccess[]),
            getPosts({ companyId, page: 1, pageSize: 20 }).catch(() => ({
              items: [] as Post[],
              totalCount: 0,
              page: 1,
              pageSize: 20,
              hasMore: false,
            })),
          ]);

        setCompany(compData);
        setUnits(unitsData);
        setAreas(areasData.filter((a) => a.isActive));
        setUsers(allUsersData.filter((u) => u.companyId === companyId));
        setAccesses(accessData);
        setPosts(postsData.items);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os dados da empresa.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [companyId],
  );

  useEffect(() => {
    void loadAllCompanyData();
  }, [loadAllCompanyData]);

  if (!companyId) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-red-600">Empresa não informada.</p>
        <button
          type="button"
          onClick={() => navigate('/app/companies')}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para empresas
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
        Carregando painel 360° da empresa...
      </div>
    );
  }

  if (errorMessage || !company) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-red-600">
          {errorMessage ?? 'Empresa não encontrada.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/companies')}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para empresas
        </button>
      </div>
    );
  }

  const tabs: Array<{
    id: TabId;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'areas', label: 'Áreas da Sede', icon: Layers3, count: areas.length },
    { id: 'units', label: 'Unidades e Filiais', icon: MapPin, count: units.length },
    { id: 'users', label: 'Colaboradores', icon: Users, count: users.length },
    {
      id: 'access-control',
      label: 'Permissões Granulares',
      icon: ShieldCheck,
      count: accesses.length,
    },
    { id: 'feed', label: 'Feed & Comunicados', icon: FileText, count: posts.length },
    { id: 'guide', label: 'Orientador & Guias', icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            to="/app/companies"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para lista de empresas
          </Link>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Painel de Governança 360°
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            {company.isActive ? (
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Ativa
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                Inativa
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-600">
            CNPJ/Documento: <strong className="text-slate-800">{company.document || 'Não informado'}</strong> · Criada em {formatDate(company.createdAt)}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadAllCompanyData({ silent: true })}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar dados
          </button>
        </div>
      </div>

      {/* Barra de Navegação em Abas */}
      <div className="border-b border-slate-200 bg-white shadow-sm ring-1 ring-slate-200 rounded-2xl p-2">
        <nav className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div>
        {activeTab === 'overview' && (
          <CompanyOverviewTab
            company={company}
            units={units}
            areas={areas}
            users={users}
            accesses={accesses}
            posts={posts}
            onSelectTab={(tabId) => setActiveTab(tabId as TabId)}
          />
        )}

        {activeTab === 'areas' && (
          <CompanyAreasSection companyId={company.id} />
        )}

        {activeTab === 'units' && (
          <CompanyUnitsSection companyId={company.id} />
        )}

        {activeTab === 'users' && (
          <CompanyUsersSection companyId={company.id} />
        )}

        {activeTab === 'access-control' && (
          <CompanyAccessControlSection companyId={company.id} />
        )}

        {activeTab === 'feed' && (
          <CompanyFeedSection companyId={company.id} />
        )}

        {activeTab === 'guide' && (
          <CompanyGuideSection companyId={company.id} />
        )}
      </div>
    </div>
  );
}