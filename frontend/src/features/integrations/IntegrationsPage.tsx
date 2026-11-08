import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { Activity, BookOpen, Check, Copy, KeyRound, Plug, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { env } from '../../app/config/env';
import { useAuth } from '../auth/providers';
import { useAdminViewContext } from '../../app/layouts/AdminLayout';
import { SystemRoles, isPlatformAdmin } from '../../shared/constants/roles';
import { SystemEmptyState, SystemLoadingState, SystemNotice, useSystemDialog } from '../../shared/components';
import {
  createIntegrationToken,
  getIntegrationCalls,
  getIntegrationScopes,
  getIntegrationTokens,
  renewIntegrationToken,
  revokeIntegrationToken,
  type CreatedIntegrationToken,
  type IntegrationCallPage,
  type IntegrationScope,
  type IntegrationToken,
  type IntegrationTokenStatus,
} from './api';

const docsUrl = `${env.apiBaseUrl}/integrations/docs`;
const pageSize = 25;

const presets: { label: string; scopes: string[] }[] = [
  { label: 'Somente consulta', scopes: ['workflows:read', 'processes:read'] },
  { label: 'Abertura de solicitações', scopes: ['workflows:read', 'processes:read', 'processes:create'] },
  { label: 'Agente de tramitação', scopes: ['workflows:read', 'processes:read', 'processes:move', 'processes:comment'] },
];

const statusStyle: Record<IntegrationTokenStatus, { label: string; className: string }> = {
  Active: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700' },
  Expired: { label: 'Expirado', className: 'bg-amber-50 text-amber-700' },
  Revoked: { label: 'Revogado', className: 'bg-slate-100 text-slate-600' },
  Invalidated: { label: 'Invalidado', className: 'bg-rose-50 text-rose-700' },
};

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('pt-BR') : '—');

type FormState = { name: string; externalSystem: string; scopes: string[] };
const emptyForm: FormState = { name: '', externalSystem: '', scopes: presets[0].scopes };

export function IntegrationsPage() {
  const { user } = useAuth();
  const { confirm } = useSystemDialog();
  const authorized = isPlatformAdmin(user?.roles) || (user?.roles.includes(SystemRoles.CompanyAdmin) ?? false);
  // A integração pertence à empresa ativa: a do Admin da Empresa ou a escolhida no seletor do Super Admin.
  const { activeCompanyId, isSuperAdmin, companies } = useAdminViewContext();
  const activeCompanyName = companies.find((c) => c.id === activeCompanyId)?.name;
  const canCreate = !isSuperAdmin || Boolean(activeCompanyId);

  const [scopes, setScopes] = useState<IntegrationScope[]>([]);
  const [tokens, setTokens] = useState<IntegrationToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ token: CreatedIntegrationToken; renewed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const [calls, setCalls] = useState<IntegrationCallPage | null>(null);
  const [callsPage, setCallsPage] = useState(1);
  const [callsToken, setCallsToken] = useState('');
  const [callsLoading, setCallsLoading] = useState(true);

  const showCalls = (page: number, tokenId = callsToken) => {
    setCallsLoading(true);
    setCallsPage(page);
    setCallsToken(tokenId);
  };

  const companyFilter = isSuperAdmin ? activeCompanyId || undefined : undefined;

  const loadTokens = useCallback(async () => {
    setTokens(await getIntegrationTokens(companyFilter));
  }, [companyFilter]);

  useEffect(() => {
    if (!authorized) return;
    let disposed = false;
    Promise.all([getIntegrationScopes(), getIntegrationTokens(companyFilter)])
      .then(([scopeList, tokenList]) => {
        if (disposed) return;
        setScopes(scopeList);
        setTokens(tokenList);
      })
      .catch((err) => !disposed && setError(err instanceof Error ? err.message : 'Falha ao carregar as integrações.'))
      .finally(() => !disposed && setLoading(false));
    return () => {
      disposed = true;
    };
  }, [authorized, companyFilter]);

  useEffect(() => {
    if (!authorized) return;
    let disposed = false;
    getIntegrationCalls(callsPage, pageSize, callsToken || undefined)
      .then((data) => !disposed && setCalls(data))
      .catch((err) => !disposed && setError(err instanceof Error ? err.message : 'Falha ao carregar o log de chamadas.'))
      .finally(() => !disposed && setCallsLoading(false));
    return () => {
      disposed = true;
    };
  }, [authorized, callsPage, callsToken]);

  const activeCount = useMemo(() => tokens.filter((t) => t.status === 'Active').length, [tokens]);

  if (!authorized) return <Navigate to="/app" replace />;

  function toggleScope(scope: string) {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.includes(scope) ? current.scopes.filter((s) => s !== scope) : [...current.scopes, scope],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.scopes.length === 0) {
      setError('Selecione pelo menos um escopo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await createIntegrationToken({
        name: form.name.trim(),
        externalSystem: form.externalSystem.trim(),
        scopes: form.scopes,
        companyId: isSuperAdmin ? activeCompanyId : undefined,
      });
      setCreated({ token: result, renewed: false });
      setCopied(false);
      setFormOpen(false);
      setForm(emptyForm);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar a integração.');
    } finally {
      setBusy(false);
    }
  }

  async function renew(token: IntegrationToken) {
    const ok = await confirm(
      `Um novo token será gerado para "${token.name}" e o atual deixará de funcionar imediatamente. Atualize o sistema externo com o novo token.`,
      { title: 'Renovar token', confirmLabel: 'Renovar' },
    );
    if (!ok) return;
    try {
      const result = await renewIntegrationToken(token.id);
      setCreated({ token: result, renewed: true });
      setCopied(false);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao renovar o token.');
    }
  }

  async function revoke(token: IntegrationToken) {
    const ok = await confirm(
      `A integração "${token.name}" (${token.externalSystem}) deixará de funcionar imediatamente. Esta ação não pode ser desfeita.`,
      { title: 'Revogar integração', confirmLabel: 'Revogar', tone: 'danger' },
    );
    if (!ok) return;
    try {
      await revokeIntegrationToken(token.id);
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao revogar o token.');
    }
  }

  async function copySecret() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token.token);
      setCopied(true);
    } catch {
      setError('Selecione o token e copie manualmente.');
    }
  }

  const totalPages = calls ? Math.max(1, Math.ceil(calls.total / pageSize)) : 1;

  return (
    <section className="mx-auto w-full max-w-[1680px] space-y-6">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 xl:flex-row xl:items-end">
        <div className="flex items-start gap-4">
          <div className="hidden h-14 w-1 shrink-0 rounded-full bg-indigo-500 sm:block" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">API de Workflows</p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">Integrações</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-500">
              Cadastre integrações para agentes e sistemas externos abrirem, consultarem e tramitarem processos da empresa,
              conforme os escopos concedidos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
          >
            <BookOpen className="h-4 w-4" />
            Swagger de integração
          </a>
          <button
            type="button"
            disabled={!canCreate}
            title={canCreate ? undefined : 'Selecione uma empresa no seletor corporativo'}
            onClick={() => {
              setFormOpen(true);
              setCreated(null);
            }}
            className="inline-flex items-center disabled:cursor-not-allowed disabled:opacity-50 gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Nova integração
          </button>
        </div>
      </header>

      {error && <SystemNotice>{error}</SystemNotice>}
      {!canCreate && (
        <SystemNotice tone="info">Selecione uma empresa no seletor corporativo para cadastrar uma integração.</SystemNotice>
      )}

      {created && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">
                  {created.renewed ? `Token de "${created.token.name}" renovado` : `Integração "${created.token.name}" cadastrada`}
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Copie agora e guarde no cofre de segredos do agente. Por segurança, ele não será exibido novamente.
                </p>
              </div>
            </div>
            <button type="button" aria-label="Fechar" onClick={() => setCreated(null)} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              value={created.token.token}
              onFocus={(e) => e.target.select()}
              aria-label="Token de integração"
              className="w-full min-w-0 rounded-xl border border-emerald-200 bg-white p-3.5 font-mono text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="button"
              onClick={() => void copySecret()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar token'}
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-emerald-800">
            Envie em cada chamada o cabeçalho <code className="rounded bg-white px-1 py-0.5">Authorization: Bearer {created.token.tokenPrefix}…</code>.
            Válido até {formatDate(created.token.expiresAt)}.
          </p>
        </div>
      )}

      {formOpen && (
        <form onSubmit={(e) => void submit(e)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Nova integração</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isSuperAdmin && activeCompanyName ? `Empresa: ${activeCompanyName}. ` : ''}Identifique a integração e o que ela poderá fazer.
              </p>
            </div>
            <button type="button" aria-label="Cancelar" onClick={() => setFormOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Nome da integração
              <input required minLength={3} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Ex.: Robô de admissões" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Sistema externo
              <input required minLength={2} maxLength={100} value={form.externalSystem} onChange={(e) => setForm({ ...form, externalSystem: e.target.value })} className={inputClass} placeholder="Ex.: Agente de IA do RH" />
            </label>
            <fieldset className="lg:col-span-2">
              <legend className="text-sm font-semibold text-slate-700">Escopos</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setForm({ ...form, scopes: preset.scopes })}
                    className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {scopes.map((scope) => (
                  <label key={scope.scope} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                    <input type="checkbox" checked={form.scopes.includes(scope.scope)} onChange={() => toggleScope(scope.scope)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
                    <span>
                      <code className="text-xs font-semibold text-slate-800">{scope.scope}</code>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{scope.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50">
              <KeyRound className="h-4 w-4" />
              {busy ? 'Gerando...' : 'Cadastrar e gerar token'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 p-5 sm:px-6">
          <h2 className="text-base font-bold text-slate-900">Integrações cadastradas</h2>
          <p className="text-sm text-slate-500">{loading ? 'Consultando...' : `${activeCount} ativo(s) de ${tokens.length} no seu escopo`}</p>
        </div>
        {loading ? (
          <SystemLoadingState label="Carregando integrações..." />
        ) : tokens.length === 0 ? (
          <SystemEmptyState icon={Plug} title="Nenhuma integração cadastrada" description="Cadastre uma integração para conectar um agente ou sistema externo aos Workflows." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-col gap-4 p-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{token.name}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[token.status].className}`}>{statusStyle[token.status].label}</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{token.tokenPrefix}…</code>
                  </div>
                  <p className="text-sm text-slate-600">
                    {token.externalSystem}
                    {isSuperAdmin && <> · <span className="font-medium">{token.companyName}</span></>}
                    {' '}· cadastrada por {token.createdByName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {token.scopes.map((s) => (
                      <span key={s} className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] text-indigo-700">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Criada {formatDate(token.createdAt)}
                    {token.renewedAt && token.renewedAt !== token.createdAt && <> · renovada {formatDate(token.renewedAt)}</>} · expira {formatDate(token.expiresAt)} · último uso {formatDate(token.lastUsedAt)}
                    {token.revokedAt && <> · revogado {formatDate(token.revokedAt)}</>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => showCalls(1, token.id)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <Activity className="h-4 w-4" />
                    Chamadas
                  </button>
                  {!token.revokedAt && (
                    <button type="button" onClick={() => void renew(token)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-3.5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                      <RefreshCw className="h-4 w-4" />
                      Renovar
                    </button>
                  )}
                  {!token.revokedAt && (
                    <button type="button" onClick={() => void revoke(token)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-600 hover:text-white">
                      <Trash2 className="h-4 w-4" />
                      Revogar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Log de auditoria das chamadas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {calls ? `${calls.callsLast7Days} chamada(s) e ${calls.errorsLast7Days} erro(s) nos últimos 7 dias. Corpo e credenciais não são gravados.` : 'Consultando...'}
            </p>
          </div>
          <select value={callsToken} onChange={(e) => showCalls(1, e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:w-72" aria-label="Filtrar por token">
            <option value="">Todos os tokens</option>
            {tokens.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {callsLoading && !calls ? (
          <SystemLoadingState label="Carregando chamadas..." />
        ) : !calls || calls.items.length === 0 ? (
          <SystemEmptyState compact icon={Activity} title="Nenhuma chamada registrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data (local)</th>
                  <th className="px-5 py-3 font-semibold">Token</th>
                  <th className="px-5 py-3 font-semibold">Operação</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.items.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3 text-slate-700">{c.tokenName}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700">
                      <span className="font-semibold">{c.method}</span> /{c.route}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.statusCode >= 400 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{c.statusCode}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">{c.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {calls && calls.total > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600 sm:px-6">
            <span>Página {callsPage} de {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={callsPage <= 1} onClick={() => showCalls(callsPage - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Anterior</button>
              <button type="button" disabled={callsPage >= totalPages} onClick={() => showCalls(callsPage + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
