import { ArrowRight, Building2, ShieldCheck, Users, Layers3 } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../../features/auth/providers';
import { FeedSummary } from '../../features/posts';

const dashboardLinks = [
  {
    title: 'Empresas',
    value: 'Administração',
    description: 'Gerencie empresas, unidades e áreas da sede.',
    href: '/app/companies',
    icon: Building2,
    iconStyle: 'bg-sky-50 text-sky-700 ring-sky-100',
  },
  {
    title: 'Usuários',
    value: 'Controle',
    description: 'Cadastre usuários e vincule perfis de acesso.',
    href: '/app/users',
    icon: Users,
    iconStyle: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    title: 'Permissões',
    value: 'Granular',
    description: 'Configure permissões por empresa, unidade e área.',
    href: '/app/users',
    icon: ShieldCheck,
    iconStyle: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-7">
      <header className="relative isolate overflow-hidden rounded-3xl bg-[#172554] px-6 py-7 text-white shadow-lg shadow-indigo-950/10 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-16 -top-36 -z-10 h-80 w-80 rounded-full border-[44px] border-white/[0.04]" />
        <div aria-hidden="true" className="absolute -bottom-40 right-56 -z-10 h-64 w-64 rounded-full border-[36px] border-white/[0.035]" />
        <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">
          <Layers3 className="h-4 w-4" aria-hidden="true" /> Visão geral
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100/80 sm:text-base">
          Bem-vindo ao ambiente administrativo do Sicou. Acesse as áreas de gestão e acompanhe as novidades.
        </p>
      </header>

      <section aria-labelledby="dashboard-shortcuts-title" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="dashboard-shortcuts-title" className="text-lg font-semibold tracking-tight text-slate-900">Acesso rápido</h2>
            <p className="mt-1 text-sm text-slate-500">Atalhos para administrar a estrutura e os acessos do Sicou.</p>
          </div>
          <span className="hidden text-xs font-medium text-slate-400 sm:block">3 áreas de gestão</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboardLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                to={item.href}
                className="group relative flex min-h-40 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${item.iconStyle}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.title}</p>
                      <h3 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950">{item.value}</h3>
                    </div>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700">
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-5 text-sm leading-5 text-slate-600">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <FeedSummary />
        </div>

        {user && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-4">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                <h2 className="text-base font-semibold tracking-tight text-slate-900">Sessão atual</h2>
              </div>
              <p className="mt-1 pl-[18px] text-xs text-slate-500">Informações do acesso ativo</p>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-semibold text-white shadow-sm shadow-indigo-600/20">
                  {user.fullName?.trim().charAt(0).toUpperCase() || 'U'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Perfis de acesso</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user.roles.map((role) => (
                    <span key={role} className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-800">{role}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
