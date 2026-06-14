import { useAuth } from '../../features/auth/providers';

export function AppDashboardPlaceholder() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Dashboard</p>

          <h1 className="mt-2 text-3xl font-bold">
            Bem-vindo ao Sicou
          </h1>

          <p className="mt-4 text-slate-600">
            Esta é uma rota protegida. O layout administrativo será construído nos próximos passos.
          </p>

          {user && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Usuário:</span> {user.fullName}
              </p>
              <p>
                <span className="font-semibold">Email:</span> {user.email}
              </p>
              <p>
                <span className="font-semibold">Roles:</span> {user.roles.join(', ')}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={signOut}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}