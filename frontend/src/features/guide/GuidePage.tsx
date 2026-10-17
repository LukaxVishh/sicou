import { NativeSelectDropdown } from '../../shared/components/NativeSelectDropdown';
import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { getGuideAreas, type GuideArea } from './api';
import { GuideWorkspace } from './GuideWorkspace';
import { SystemEmptyState, SystemLoadingState, SystemNotice } from '../../shared/components';

export function GuidePage({ companyId }: { companyId?: string }) {
  const [searchParams] = useSearchParams();
  const contextAreaId = companyId ? null : searchParams.get('areaId');
  const [areas, setAreas] = useState<GuideArea[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    getGuideAreas().then(data => {
      if (!active) return;
      const allowed = data.filter(a => (!companyId || a.companyId === companyId) && (!contextAreaId || a.id === contextAreaId));
      setAreas(allowed);
      setSelected(previous => allowed.some(a => a.id === previous) ? previous : allowed[0]?.id ?? '');
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar áreas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, contextAreaId, revision]);
  return <div className="mx-auto w-full max-w-[1680px] space-y-6">
    <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
      <div className="flex items-start gap-4">
        <span className="hidden h-14 w-1 shrink-0 rounded-full bg-amber-500 sm:block" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Procedimentos e conhecimento</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">Orientador</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-5 text-slate-500">Consulte procedimentos, links e arquivos publicados pelas áreas.</p>
        </div>
      </div>
      <button type="button" className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto" disabled={loading}
        onClick={() => { setLoading(true); setError(''); setRevision(r => r + 1); }}><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
    </header>
    {error && <SystemNotice>{error}</SystemNotice>}
    {loading ? <SystemLoadingState label="Carregando áreas..." /> : <>
      {areas.length === 0 ? <SystemEmptyState title="Nenhuma área disponível" description="Nenhuma área autorizada com o Orientador habilitado." /> : <>
        <label className="block text-sm font-medium">Área
          <NativeSelectDropdown className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3" value={selected} onChange={e => setSelected(e.target.value)}>
            {areas.map(a => <option key={a.id} value={a.id}>{a.companyName} — {a.name}</option>)}
          </NativeSelectDropdown>
        </label>
        <GuideWorkspace key={`${selected}-${revision}`} areaId={selected} />
      </>}
    </>}
  </div>;
}
