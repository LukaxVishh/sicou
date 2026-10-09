import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { KeyRound } from 'lucide-react';
import { apiFetch } from '../../../shared/api';
import { useAuth } from '../providers';

type RecoveryUser = { id: string; fullName: string; email: string };
type TemporaryPassword = { temporaryPassword: string; expiresAt: string };

export function PasswordRecoveryPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedUserId = searchParams.get('userId');
  const authorized = user?.roles.some(r => ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(r));
  const [users, setUsers] = useState<RecoveryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RecoveryUser | null>(null);
  const [result, setResult] = useState<TemporaryPassword | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!authorized) return;
    let disposed = false;
    async function load() {
      try {
        const data = await apiFetch<RecoveryUser[]>('/api/password-recovery/users');
        if (!disposed) {
          setUsers(data);
          if (selectedUserId) setSelected(data.find(candidate => candidate.id === selectedUserId) ?? null);
        }
      }
      catch (err) { if (!disposed) setError(err instanceof Error ? err.message : 'Falha ao consultar usuários.'); }
      finally { if (!disposed) setLoading(false); }
    }
    void load();
    return () => { disposed = true; };
  }, [authorized, user?.id, selectedUserId]);

  async function generate() {
    if (!selected) return;
    setBusy(true); setError('');
    try { setResult(await apiFetch<TemporaryPassword>(`/api/password-recovery/users/${selected.id}/temporary-password`, { method: 'POST' })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao gerar senha.'); }
    finally { setBusy(false); }
  }
  function close() { setSelected(null); setResult(null); setCopied(false); setError(''); }
  if (!authorized) return <Navigate to="/app" replace />;
  const filtered = users.filter(u => `${u.fullName} ${u.email}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  return <section className="space-y-5">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound /> Recuperação de senha</h1>
    <p className="text-sm text-slate-600">Super Admin e Admin da Empresa podem recuperar usuários de cargo inferior dentro da empresa que administram.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {selected ? <div className="max-w-xl space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">{selected.fullName}</h2><p>{selected.email}</p>
      {result ? <>
        <p className="text-sm">Entregue esta senha ao usuário por um canal privado. Ela é exibida somente nesta geração.</p>
        <label className="block text-sm">Senha temporária<input readOnly value={result.temporaryPassword} className="mt-1 w-full rounded border p-3 font-mono" onFocus={e => e.target.select()} /></label>
        <p className="text-sm">Válida até {new Date(result.expiresAt).toLocaleString('pt-BR')}. No login, o usuário deverá definir a senha definitiva.</p>
        <button className="rounded-lg border px-4 py-2" onClick={async () => {
          try { await navigator.clipboard.writeText(result.temporaryPassword); setCopied(true); }
          catch { setError('Selecione a senha e copie manualmente.'); }
        }}>{copied ? 'Senha copiada' : 'Copiar senha'}</button>
      </> : <>
        <p className="text-sm text-slate-600">Gerar uma senha temporária substitui a senha atual e encerra as sessões desse usuário. Ela vale por 24 horas.</p>
        <button disabled={busy} onClick={() => void generate()} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Gerando...' : 'Gerar senha temporária'}</button>
      </>}
      <button disabled={busy} onClick={close} className="ml-3 rounded-lg border px-4 py-2">{result ? 'Concluir' : 'Voltar'}</button>
    </div> : <>
      <label className="block max-w-xl text-sm">Buscar usuário<input value={query} onChange={e => setQuery(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3" placeholder="Nome ou e-mail" /></label>
      {loading ? <p>Carregando usuários...</p> : <ul className="divide-y rounded-xl border bg-white">
        {filtered.map(u => <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{u.fullName}</p><p className="text-sm text-slate-500">{u.email}</p></div><button onClick={() => setSelected(u)} className="rounded-lg border px-3 py-2 text-sm">Recuperar acesso</button></li>)}
        {!filtered.length && <li className="p-5 text-slate-500">Nenhum usuário elegível para recuperação.</li>}
      </ul>}
    </>}
  </section>;
}
