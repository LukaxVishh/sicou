import { Building2, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../features/auth/providers';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <div>
        <p className="text-sm font-medium text-slate-500">Visão geral</p>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Bem-vindo ao ambiente administrativo do Sicou.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3">
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-500">Empresas</p>
              <p className="text-xl font-bold text-slate-900">Administração</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            Gerencie empresas, unidades e áreas da sede.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3">
              <Users className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-500">Usuários</p>
              <p className="text-xl font-bold text-slate-900">Controle</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            Cadastre usuários e vincule perfis de acesso.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-500">Permissões</p>
              <p className="text-xl font-bold text-slate-900">Granular</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            Configure permissões por empresa, unidade e área.
          </p>
        </div>
      </div>

      {user && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Sessão atual
          </h2>

          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div>
              <p className="font-medium text-slate-500">Nome</p>
              <p>{user.fullName}</p>
            </div>

            <div>
              <p className="font-medium text-slate-500">E-mail</p>
              <p>{user.email}</p>
            </div>

            <div>
              <p className="font-medium text-slate-500">Perfis</p>
              <p>{user.roles.join(', ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}