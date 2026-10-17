import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../providers';
import { changePassword } from '../api/authApi';
import { saveAuthSession } from '../lib';
import { SystemNotice } from '../../../shared/components';

export function ChangePasswordPage() {
  const { user, isLoading, refreshCurrentUser, signOut } = useAuth();
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setError('A confirmação deve ser igual à nova senha.'); return; }
    setBusy(true); setError('');
    try {
      const session = await changePassword(temporaryPassword, newPassword);
      saveAuthSession(session);
      await refreshCurrentUser();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.'); }
    finally { setBusy(false); }
  }

  if (isLoading) return <p className="p-8">Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/app" replace />;
  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#eef2ff_0%,_#f8fafc_50%,_#f1f5f9_100%)] p-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-8">
      <img
        src="/logos/separadas/logo-sicou-horizontal.png"
        alt="Sicou — Governança Operacional"
        className="mb-6 h-auto w-48 max-w-full object-contain"
      />
      <h1 className="text-2xl font-bold text-slate-900">Defina sua senha definitiva</h1>
      <p className="mt-3 text-sm text-slate-600">Você entrou com uma senha temporária. Defina uma nova senha para continuar usando o Sicou.</p>
      <p className="mt-2 text-sm font-medium">{user.email}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">Senha temporária
          <input type="password" autoComplete="current-password" required value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </label>
        <label className="block text-sm">Nova senha
          <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </label>
        <p className="text-xs text-slate-500">Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número. A nova senha deve ser diferente da temporária.</p>
        <label className="block text-sm">Confirme a nova senha
          <input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </label>
        {error && <SystemNotice>{error}</SystemNotice>}
        <button disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Salvando...' : 'Salvar senha definitiva'}</button>
      </form>
      <button onClick={signOut} className="mt-5 text-sm text-slate-600 underline">Sair e voltar ao login</button>
    </section>
  </main>;
}
