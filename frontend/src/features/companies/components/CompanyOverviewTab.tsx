import {
  ArrowRight,
  Briefcase,
  FileText,
  Layers3,
  MapPin,
  Pin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Company } from '../types';
import type { Unit } from '../../units/types';
import type { CompanyArea } from '../../areas/types';
import type { User } from '../../users/types';
import type { UserAreaAccess } from '../../access-control/types';
import type { Post } from '../../posts/types';

type CompanyOverviewTabProps = {
  company: Company;
  units: Unit[];
  areas: CompanyArea[];
  users: User[];
  accesses: UserAreaAccess[];
  posts: Post[];
  onSelectTab: (tabId: string) => void;
};

export function CompanyOverviewTab({
  units,
  areas,
  users,
  accesses,
  posts,
  onSelectTab,
}: CompanyOverviewTabProps) {
  const companyAdmins = users.filter((u) => u.roles.includes('COMPANY_ADMIN'));
  const hqUsers = users.filter((u) => u.roles.includes('HEADQUARTER_USER') || u.roles.includes('AREA_ADMIN'));
  const unitUsers = users.filter((u) => u.roles.includes('UNIT_USER'));

  return (
    <div className="space-y-6">
      {/* Grid de Resumo Executivo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Unidades */}
        <div
          onClick={() => onSelectTab('units')}
          className="group cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <MapPin className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">{units.length}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Unidades / Filiais
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {units.filter((u) => u.isActive).length} ativas na rede de atendimento
          </p>
        </div>

        {/* Card 2: Áreas da Sede */}
        <div
          onClick={() => onSelectTab('areas')}
          className="group cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <Layers3 className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">{areas.length}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Áreas da Sede
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Departamentos de governança central
          </p>
        </div>

        {/* Card 3: Colaboradores */}
        <div
          onClick={() => onSelectTab('users')}
          className="group cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-purple-50 p-2.5 text-purple-700">
              <Users className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">{users.length}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Colaboradores
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {hqUsers.length} na sede · {unitUsers.length} em filiais
          </p>
        </div>

        {/* Card 4: Permissões Granulares */}
        <div
          onClick={() => onSelectTab('access-control')}
          className="group cursor-pointer rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">{accesses.length}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Regras de Permissão
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Privilégios setoriais atribuídos
          </p>
        </div>
      </div>

      {/* Seção 2: Estrutura Organizacional & Distribuição de Pessoas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribuição de Colaboradores */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                <Briefcase className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Enquadramento da Equipe
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('users')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Ver todos →
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-indigo-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Administradores da Empresa
                  </p>
                  <p className="text-xs text-slate-500">
                    Gestão geral e governança do tenant
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900">{companyAdmins.length}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Usuários e Gestores da Sede
                  </p>
                  <p className="text-xs text-slate-500">
                    Alocados em departamentos (Jurídico, RH, TI, etc.)
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900">{hqUsers.length}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Colaboradores de Unidades / Filiais
                  </p>
                  <p className="text-xs text-slate-500">
                    Atendimento em agências e postos de atendimento
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900">{unitUsers.length}</span>
            </div>
          </div>
        </div>

        {/* Resumo de Áreas & Módulos */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                <Layers3 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Áreas da Sede e Módulos Ativos
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('areas')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Gerenciar →
            </button>
          </div>

          <div className="mt-5 space-y-2.5">
            {areas.slice(0, 4).map((area) => (
              <div
                key={area.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{area.name}</p>
                  <p className="text-xs text-slate-500">{area.description || 'Sem descrição'}</p>
                </div>
                <div className="flex gap-1.5">
                  {area.modules
                    .filter((m) => m.enabled)
                    .map((m) => (
                      <span
                        key={m.moduleId}
                        className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                      >
                        {m.code === 'Informatives'
                          ? 'Informativos'
                          : m.code === 'Guide'
                            ? 'Orientador'
                            : 'Workflows'}
                      </span>
                    ))}
                </div>
              </div>
            ))}

            {areas.length > 4 && (
              <p className="text-center text-xs text-slate-500 pt-1">
                + {areas.length - 4} outra(s) área(s) cadastrada(s)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Seção 3: Últimos Comunicados do Feed */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Últimos Comunicados do Feed Corporativo
              </h3>
              <p className="text-xs text-slate-500">
                Mensagens emitidas pelas áreas da sede para todos os colaboradores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('feed')}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Abrir Feed completo ({posts.length}) →
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Nenhum comunicado publicado ainda para esta empresa.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {posts.slice(0, 2).map((post) => (
              <div
                key={post.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    {post.isGlobal ? 'Global' : post.companyName}
                  </span>
                  {post.isPinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      <Pin className="h-3 w-3 fill-amber-600" />
                      Fixado
                    </span>
                  )}
                </div>
                <h4 className="mt-2 text-sm font-bold text-slate-900">{post.title}</h4>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {post.content}
                </p>
                <p className="mt-3 text-xs text-slate-400">Por {post.authorName}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
