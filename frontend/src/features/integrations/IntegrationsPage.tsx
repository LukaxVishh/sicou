import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../shared/api/apiFetch';
import { useSystemDialog } from '../../shared/components/SystemDialogProvider';
import { AutomationPanel } from './AutomationPanel';

type Token = { id: string; name: string; externalSystem: string; scopes: string; createdAt: string; expiresAt: string; revokedAt: string | null };
type Call = { id: string; tokenId: string; method: string; route: string; statusCode: number; durationMs: number; createdAt: string };
type Calls = { total: number; lastSevenDays: { calls: number; errors: number }; items: Call[] };
const labels: Record<string, string> = {
  'posts:create': 'Criar posts', 'processes:create': 'Abrir processos', 'processes:read': 'Consultar processos e árvores',
  'processes:write': 'Preencher, protocolar e avançar processos', 'processes:cancel': 'Cancelar processos',
  'processes:transfer': 'Transferir processos', 'reports:read': 'Consultar e exportar relatórios de processos',
  'imports:read': 'Consultar opções e modelos de importação', 'imports:write': 'Validar e confirmar importações',
  'documents:process': 'Processar documentos DOCX, XLSX, CSV e PDF',
  'automations:read': 'Consultar monitoramento de automações', 'automations:write': 'Registrar execuções e atividade de automações',
};
const date = (value: string) => new Date(value).toLocaleString('pt-BR');
const button = 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export function IntegrationsPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [calls, setCalls] = useState<Calls | null>(null);
  const [page, setPage] = useState(1);
  const [name, setName] = useState('');
  const [externalSystem, setExternalSystem] = useState('');
  const [days, setDays] = useState(30);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { confirm } = useSystemDialog();
  const refresh = useCallback(async () => {
    const [tokenList, scopeList, history] = await Promise.all([
      apiFetch<Token[]>('/api/integrations/tokens'), apiFetch<string[]>('/api/integrations/scopes'),
      apiFetch<Calls>(`/api/integrations/calls?page=${page}&pageSize=25`),
    ]);
    setTokens(tokenList); setScopes(scopeList); setCalls(history);
  }, [page]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<Token[]>('/api/integrations/tokens'), apiFetch<string[]>('/api/integrations/scopes'),
      apiFetch<Calls>(`/api/integrations/calls?page=${page}&pageSize=25`),
    ]).then(([tokenList, scopeList, history]) => {
      if (active) { setTokens(tokenList); setScopes(scopeList); setCalls(history); }
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar integrações.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao executar operação.'); }
    finally { setBusy(false); }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const result = await apiFetch<{ token: string }>('/api/integrations/tokens', {
        method: 'POST', body: JSON.stringify({ name, externalSystem, expiresInDays: days, scopes: selected }),
      });
      setSecret(result.token); setName(''); setExternalSystem(''); setSelected([]);
    });
  }

  async function revoke(token: Token) {
    if (!await confirm(`Revogar o token “${token.name}”? As aplicações que o utilizam perderão o acesso.`, { title: 'Revogar token', tone: 'danger', confirmLabel: 'Revogar' })) return;
    void run(async () => { await apiFetch(`/api/integrations/tokens/${token.id}`, { method: 'DELETE' }); });
  }

  return <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><KeyRound /> Integrações</h1>
        <p className="mt-2 text-sm text-slate-600">Conecte suas automações usando tokens com validade e permissões específicas.</p></div>
      <button type="button" disabled={busy || loading} className={button} onClick={() => void run(async () => {})}><RefreshCw className="mr-2 inline h-4 w-4" />Atualizar</button>
    </header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {secret && <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5" aria-label="Token criado">
      <h2 className="font-bold">Copie seu token agora</h2><p className="text-sm">Ele será exibido uma única vez. Guarde-o em um local seguro e use no cabeçalho Authorization: Bearer TOKEN.</p>
      <code className="block break-all rounded-lg bg-white p-3 select-all">{secret}</code>
      <button type="button" className={button} onClick={() => setSecret('')}>Já guardei, ocultar token</button>
    </section>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Criar token</h2>
      <p className="mt-2 text-sm text-slate-600">O token usa seus acessos atuais e os escopos selecionados. Mudanças de senha, empresa ou unidade invalidam o token.</p>
      <form onSubmit={create} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Nome da integração<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2" placeholder="Ex.: Automação do financeiro" /></label>
          <label className="text-sm">Sistema externo<input required maxLength={100} value={externalSystem} onChange={e => setExternalSystem(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2" placeholder="Ex.: Robô financeiro / ERP" /></label>
          <label className="text-sm">Validade em dias (1 a 365)<input type="number" required min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} className="mt-1 block w-full rounded-xl border border-slate-300 p-2" /></label></div>
        <fieldset><legend className="mb-2 text-sm font-semibold">Permissões do token</legend><div className="grid gap-3 sm:grid-cols-2">{scopes.map(scope => <label key={scope} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(scope)} onChange={e => setSelected(current => e.target.checked ? [...current, scope] : current.filter(s => s !== scope))} />{labels[scope] ?? scope}</label>)}</div></fieldset>
        <button disabled={busy || loading || selected.length === 0 || !!secret || !name.trim() || !externalSystem.trim()} className={button}>{busy ? 'Salvando...' : 'Criar token'}</button>
      </form>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Meus tokens</h2>
      {loading ? <p className="mt-4" role="status">Carregando...</p> : tokens.length === 0 ? <p className="mt-4 text-sm text-slate-500">Você ainda não criou tokens.</p> : <ul className="mt-4 divide-y divide-slate-100">{tokens.map(token => <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><p className="font-semibold">{token.name} <span className="text-xs font-normal text-slate-500">{token.revokedAt ? 'Revogado' : new Date(token.expiresAt) <= new Date() ? 'Expirado' : 'Não revogado'}</span></p>
          <p className="mt-1 text-xs text-slate-500">Sistema externo: {token.externalSystem}</p><p className="mt-1 text-xs text-slate-500">Expira em {date(token.expiresAt)}</p><p className="mt-1 break-words text-xs text-slate-600">{token.scopes.split(' ').map(s => labels[s] ?? s).join(' · ')}</p></div>
        {!token.revokedAt && <button type="button" disabled={busy} onClick={() => void revoke(token)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">Revogar</button>}
      </li>)}</ul>}
    </section>
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Chamadas das minhas integrações</h2>
      <p className="text-sm text-slate-600">Últimos 7 dias: <strong>{calls?.lastSevenDays.calls ?? 0}</strong> chamadas · <strong>{calls?.lastSevenDays.errors ?? 0}</strong> erros. Apenas chamadas com tokens reconhecidos são contabilizadas.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="p-2">Data</th><th className="p-2">Token</th><th className="p-2">Operação</th><th className="p-2">Status</th><th className="p-2">Duração</th></tr></thead><tbody>{calls?.items.map(call => <tr key={call.id} className="border-b border-slate-100"><td className="whitespace-nowrap p-2">{date(call.createdAt)}</td><td className="p-2">{tokens.find(t => t.id === call.tokenId)?.name ?? 'Token removido'}</td><td className="p-2"><code>{call.method} {call.route}</code></td><td className={`p-2 ${call.statusCode >= 400 ? 'text-rose-700' : 'text-emerald-700'}`}>{call.statusCode}</td><td className="whitespace-nowrap p-2">{call.durationMs} ms</td></tr>)}</tbody></table></div>
      {!loading && !calls?.items.length && <p className="text-sm text-slate-500">Nenhuma chamada nesta página.</p>}
      <div className="flex items-center gap-3 text-sm"><button type="button" disabled={page === 1 || busy} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page}</span><button type="button" disabled={!calls || page * 25 >= calls.total || busy} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div>
    </section>
    <AutomationPanel />
  </div>;
}
