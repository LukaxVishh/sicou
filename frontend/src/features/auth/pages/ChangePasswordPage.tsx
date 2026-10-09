import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../providers';
import { changePassword } from '../api/authApi';
import { saveAuthSession } from '../lib';

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
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Defina sua senha definitiva</h1>
      <p className="mt-3 text-sm text-slate-600">Você entrou com uma senha temporária. Defina uma nova senha para continuar usando o Sicou.</p>
      <p className="mt-2 text-sm font-medium">{user.email}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">Senha temporária
          <input type="password" autoComplete="current-password" required value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3" />
        </label>
        <label className="block text-sm">Nova senha
          <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3" />
        </label>
        <p className="text-xs text-slate-500">Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número. A nova senha deve ser diferente da temporária.</p>
        <label className="block text-sm">Confirme a nova senha
          <input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-lg border p-3" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Salvando...' : 'Salvar senha definitiva'}</button>
      </form>
      <button onClick={signOut} className="mt-5 text-sm text-slate-600 underline">Sair e voltar ao login</button>
    </section>
  </main>;
}
