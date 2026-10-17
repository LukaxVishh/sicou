import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../providers';
import { SystemNotice } from '../../../shared/components';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const { isAuthenticated, isLoading, signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as LocationState | null;
  const redirectTo = state?.from?.pathname ?? '/app/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signIn({
        email,
        password,
      });

      navigate(redirectTo, {
        replace: true,
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível realizar o login.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Carregando sessão...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={user?.mustChangePassword ? '/change-password' : '/app'} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#eef2ff_0%,_#f8fafc_50%,_#f1f5f9_100%)] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-8">
        <div>
          <img
            src="/logos/separadas/logo-sicou-horizontal.png"
            alt="Sicou — Governança Operacional"
            className="mb-6 h-auto w-52 max-w-full object-contain"
          />

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Entrar na plataforma
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Use suas credenciais para acessar o ambiente administrativo.
          </p>
        </div>

        {errorMessage && (
          <SystemNotice className="mt-6">{errorMessage}</SystemNotice>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              E-mail ou login
            </label>

            <input
              id="email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="E-mail ou nome de usuário"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Digite sua senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600">
          <Link to="/forgot-password" className="font-medium text-indigo-700 underline">Esqueci minha senha</Link>
          <span className="mt-2 block">Você também pode solicitar uma senha temporária ao administrador responsável.</span>
        </p>

        <p className="mt-6 text-xs text-slate-500">
          Ambiente local conectado à API do Sicou.
        </p>
      </div>
    </div>
  );
}
