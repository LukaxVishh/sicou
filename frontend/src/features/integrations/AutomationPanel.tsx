import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/providers';
import { useAdminViewContext } from '../../app/layouts/AdminLayout';
import { apiFetch } from '../../shared/api/apiFetch';
import { useSystemDialog } from '../../shared/components/SystemDialogProvider';

type Automation = { id: string; userId: string; name: string; isActive: boolean; heartbeatTimeoutSeconds: number; maxRunMinutes: number; expectedIntervalMinutes: number | null };
type Alert = { id: string; automationId: string; kind: string; message: string; createdAt: string; acknowledgedAt: string | null };
type Dashboard = { automations: Automation[]; summary: { running: number; succeeded: number; failed: number; unacknowledgedAlerts: number }; alerts: Alert[] };
type Run = { id: string; externalId: string; status: string; host: string; startedAt: string; lastHeartbeatAt: string; finishedAt: string | null; durationMs: number | null; exitCode: number | null; message: string | null };
const statusNames: Record<string, string> = { Running: 'Em execução', Succeeded: 'Concluída', Failed: 'Falhou', Interrupted: 'Interrompida' };
const button = 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const input = 'mt-1 block w-full rounded-xl border border-slate-300 p-2';
const date = (value: string) => new Date(value).toLocaleString('pt-BR');

export function AutomationPanel() {
  const { user } = useAuth();
  const context = useAdminViewContext();
  const companyId = context?.isSuperAdmin ? context.selectedCompanyId : '';
  const { confirm } = useSystemDialog();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState<{ total: number; items: Run[] } | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [name, setName] = useState('');
  const [interval, setInterval] = useState('');
  const [timeout, setTimeoutSeconds] = useState(120);
  const [maxMinutes, setMaxMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const data = await apiFetch<Dashboard>(`/api/automations${companyId ? `?companyId=${companyId}` : ''}`, { signal });
    if (signal?.aborted) return;
    setDashboard(data);
    if (selected && !data.automations.some(a => a.id === selected)) { setSelected(''); setHistory(null); }
    else if (selected) {
      const next = await apiFetch<{ total: number; items: Run[] }>(`/api/automations/${selected}/runs?page=${page}&pageSize=10${status ? `&status=${status}` : ''}`, { signal });
      if (!signal?.aborted) setHistory(next);
    }
    if (!signal?.aborted) setError('');
  }, [companyId, selected, page, status]);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      if (!document.hidden) void refresh(controller.signal).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Falha ao carregar automações.'); });
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  async function act(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha na operação.'); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    void act(async () => {
      await apiFetch('/api/automations', { method: 'POST', body: JSON.stringify({ name, heartbeatTimeoutSeconds: timeout, maxRunMinutes: maxMinutes, expectedIntervalMinutes: interval ? Number(interval) : null }) });
      setName('');
    });
  }
  async function toggle(automation: Automation) {
    if (!await confirm(automation.isActive ? 'Pausar novos inícios e alertas de atraso? Execuções em andamento continuam monitoradas.' : 'Retomar novos inícios e o monitoramento de atraso?', { title: automation.name })) return;
    void act(async () => { await apiFetch(`/api/automations/${automation.id}`, { method: 'PUT', body: JSON.stringify({ ...automation, isActive: !automation.isActive }) }); });
  }
  return <section aria-label="Monitoramento de automações" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">Execuções das automações</h2><p className="mt-1 text-sm text-slate-600">Acompanhe atividade, resultado e alertas. Atualização a cada 15 segundos.</p></div><button type="button" disabled={busy} onClick={() => void act(async () => {})} className={button}>Atualizar execuções</button></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!dashboard ? <p role="status">Carregando monitoramento...</p> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Em execução', dashboard.summary.running], ['Concluídas em 7 dias', dashboard.summary.succeeded],
        ['Falhas/interrupções em 7 dias', dashboard.summary.failed], ['Alertas não reconhecidos', dashboard.summary.unacknowledgedAlerts],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">{label}</p><strong className="text-2xl">{value}</strong></div>)}</div>
      <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">Cadastrar automação</summary><p className="mt-2 text-sm text-slate-600">O cadastro pertence à sua conta e ao seu vínculo atual. Configure o agente no servidor usando o ID e um token com permissão para registrar execuções.</p>
        <form onSubmit={create} className="mt-4 space-y-3"><label className="block text-sm">Nome da automação<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={input} /></label>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Tempo sem atividade (segundos)<input type="number" min={30} max={3600} required value={timeout} onChange={e => setTimeoutSeconds(Number(e.target.value))} className={input} /></label><label className="text-sm">Duração máxima (minutos)<input type="number" min={1} max={1440} required value={maxMinutes} onChange={e => setMaxMinutes(Number(e.target.value))} className={input} /></label><label className="text-sm">Intervalo esperado (minutos)<input type="number" min={1} max={10080} value={interval} onChange={e => setInterval(e.target.value)} placeholder="Sem agendamento" className={input} /></label></div>
          <p className="text-xs text-slate-500">O intervalo monitora a frequência de início; não agenda nem executa a automação.</p><button disabled={busy || !name.trim()} className={button}>Cadastrar automação</button>
        </form>
      </details>
      {!dashboard.automations.length ? <p className="text-sm text-slate-500">Nenhuma automação neste contexto.</p> : <div className="space-y-3">{dashboard.automations.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="font-semibold">{a.name} <span className="text-xs font-normal text-slate-500">{a.isActive ? 'Ativa' : 'Pausada'}</span></p><p className="break-all text-xs text-slate-500">ID: {a.id}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setSelected(a.id); setPage(1); setHistory(null); }}>Ver execuções de {a.name}</button>{a.userId === user?.id && <button type="button" disabled={busy} onClick={() => void toggle(a)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{a.isActive ? 'Pausar' : 'Retomar'}</button>}</div></div>)}</div>}
      {selected && <section aria-label="Histórico de execuções" className="space-y-3"><label className="block text-sm">Filtrar execuções por status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={input}><option value="">Todos</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {!history ? <p role="status">Carregando execuções...</p> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Início</th><th className="p-2">Servidor</th><th className="p-2">Status</th><th className="p-2">Duração</th><th className="p-2">Resultado</th></tr></thead><tbody>{history.items.map(run => <tr key={run.id} className="border-b border-slate-100"><td className="whitespace-nowrap p-2">{date(run.startedAt)}</td><td className="p-2">{run.host || 'Não informado'}</td><td className="p-2">{statusNames[run.status] ?? run.status}</td><td className="whitespace-nowrap p-2">{run.durationMs === null ? 'Em andamento' : `${(run.durationMs / 1000).toFixed(1)} s`}</td><td className="max-w-sm break-words p-2">{run.message ?? '—'}{run.exitCode !== null && ` (código ${run.exitCode})`}</td></tr>)}</tbody></table></div>{!history.items.length && <p className="text-sm text-slate-500">Nenhuma execução para este filtro.</p>}
          <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border p-2 disabled:opacity-40">Execuções anteriores</button><span>Página {page}</span><button type="button" disabled={page * 10 >= history.total} onClick={() => setPage(p => p + 1)} className="rounded-lg border p-2 disabled:opacity-40">Mais execuções</button></div></>}
      </section>}
      <section aria-label="Alertas de automações"><h3 className="font-semibold">Alertas recentes</h3>{!dashboard.alerts.length ? <p className="mt-2 text-sm text-slate-500">Nenhum alerta registrado.</p> : <ul className="mt-3 space-y-2">{dashboard.alerts.map(alert => <li key={alert.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3"><div><p className="text-sm font-semibold">{dashboard.automations.find(a => a.id === alert.automationId)?.name}</p><p className="text-sm">{alert.message}</p><p className="text-xs text-slate-500">{date(alert.createdAt)}</p></div>{alert.acknowledgedAt ? <span className="text-xs text-slate-500">Reconhecido</span> : <button type="button" disabled={busy} onClick={() => void act(async () => { await apiFetch(`/api/automations/alerts/${alert.id}/acknowledge`, { method: 'POST' }); })} className="rounded-lg border border-amber-300 p-2 text-sm disabled:opacity-50">Reconhecer alerta</button>}</li>)}</ul>}</section>
    </>}
  </section>;
}
