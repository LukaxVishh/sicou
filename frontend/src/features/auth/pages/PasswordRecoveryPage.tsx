import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { ArrowLeft, Check, Copy, KeyRound, Search, ShieldCheck, Users } from 'lucide-react';
import { apiFetch } from '../../../shared/api';
import { useAuth } from '../providers';
import { SystemEmptyState, SystemLoadingState, SystemNotice } from '../../../shared/components';

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
  return <section className="mx-auto w-full max-w-[1680px] space-y-6">
    <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 xl:flex-row xl:items-end">
      <div className="flex items-start gap-4">
        <div className="hidden h-14 w-1 shrink-0 rounded-full bg-indigo-500 sm:block" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">Gestão de acessos</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">Recuperação de senha</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-5 text-slate-500">
            Ajude sua equipe a voltar ao sistema. Selecione um acesso para gerar uma nova senha temporária.
          </p>
        </div>
      </div>
      <div className="flex items-center xl:pb-0.5">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" />Acesso administrativo
        </span>
      </div>
    </header>
    {error && <SystemNotice>{error}</SystemNotice>}
    {selected ? <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6 sm:p-8"><button disabled={busy} onClick={close} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 disabled:opacity-50"><ArrowLeft className="h-4 w-4" />Voltar aos acessos</button><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{result ? 'Senha gerada' : 'Redefinir acesso'}</p><h2 className="mt-2 text-xl font-bold text-slate-900">{selected.fullName}</h2><p className="mt-1 break-all text-sm text-slate-500">{selected.email}</p></div>
      <div className="space-y-5 p-6 sm:p-8">
      {result ? <>
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><Check className="mt-1 h-4 w-4 shrink-0" />Senha temporária criada. Compartilhe com o usuário por um canal privado; ela é exibida somente nesta geração.</div>
        <label className="block text-sm font-semibold text-slate-700">Senha temporária<input readOnly value={result.temporaryPassword} className="mt-2 w-full rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 font-mono text-sm text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500" onFocus={e => e.target.select()} /></label>
        <p className="text-sm leading-6 text-slate-500">Válida até {new Date(result.expiresAt).toLocaleString('pt-BR')}. No próximo login, o usuário deverá definir a senha definitiva.</p>
        <div className="flex flex-wrap gap-3"><button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" onClick={async () => {
          try { await navigator.clipboard.writeText(result.temporaryPassword); setCopied(true); }
          catch { setError('Selecione a senha e copie manualmente.'); }
        }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Senha copiada' : 'Copiar senha'}</button><button onClick={close} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Concluir</button></div>
      </> : <>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p className="font-semibold">Confirme antes de continuar</p><p className="mt-1">A senha atual será substituída e as sessões deste usuário serão encerradas. A nova senha vale por 24 horas.</p></div>
        <button disabled={busy} onClick={() => void generate()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-50"><KeyRound className="h-4 w-4" />{busy ? 'Gerando senha...' : 'Gerar senha temporária'}</button>
      </>}
      </div>
    </div> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="text-base font-bold text-slate-900">Acessos da equipe</h2><p className="mt-1 text-sm text-slate-500">{loading ? 'Consultando acessos...' : filtered.length + ' acessos disponíveis para recuperação'}</p></div><label className="relative block sm:w-80"><span className="sr-only">Buscar usuário</span><Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100" placeholder="Buscar nome ou e-mail" /></label></div>
      {loading ? <SystemLoadingState label="Carregando usuários..." /> : <ul className="divide-y divide-slate-100">
        {filtered.map(u => <li key={u.id} className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-bold text-indigo-600">{u.fullName.split(' ').filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase()}</span><div className="min-w-0"><p className="font-semibold text-slate-800">{u.fullName}</p><p className="mt-0.5 break-all text-sm text-slate-500">{u.email}</p></div></div><button onClick={() => setSelected(u)} aria-label={`Resetar senha de ${u.fullName}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"><KeyRound className="h-4 w-4" />Resetar senha</button></li>)}
        {!filtered.length && <li><SystemEmptyState icon={Users} compact title="Nenhum acesso encontrado" description={query ? 'Tente buscar por outro nome ou e-mail.' : 'Não há usuários elegíveis para recuperação no seu escopo.'} /></li>}
      </ul>}
      <p className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs leading-5 text-slate-500">A lista apresenta apenas os acessos que seu perfil pode recuperar.</p>
    </div>}
  </section>;
}
