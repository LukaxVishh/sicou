import { useEffect, useState } from 'react';
import { BookOpen, RefreshCcw } from 'lucide-react';
import { getGuideAreas, type GuideArea } from './api';
import { GuideWorkspace } from './GuideWorkspace';

export function GuidePage({ companyId }: { companyId?: string }) {
  const [areas, setAreas] = useState<GuideArea[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    getGuideAreas().then(data => {
      if (!active) return;
      const allowed = data.filter(a => !companyId || a.companyId === companyId);
      setAreas(allowed);
      setSelected(previous => allowed.some(a => a.id === previous) ? previous : allowed[0]?.id ?? '');
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar áreas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, revision]);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3"><BookOpen className="h-8 w-8 text-amber-600" /><div>
        <h1 className="text-2xl font-bold text-slate-900">Orientador</h1>
        <p className="text-sm text-slate-500">Procedimentos, links e arquivos das áreas.</p>
      </div></div>
      <button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" disabled={loading}
        onClick={() => { setLoading(true); setError(''); setRevision(r => r + 1); }}><RefreshCcw size={16} /> Atualizar</button>
    </header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>}
    {loading ? <p role="status">Carregando áreas...</p> : <>
      {areas.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Nenhuma área autorizada com o Orientador habilitado.</p> : <>
        <label className="block text-sm font-medium">Área
          <select className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3" value={selected} onChange={e => setSelected(e.target.value)}>
            {areas.map(a => <option key={a.id} value={a.id}>{a.companyName} — {a.name}</option>)}
          </select>
        </label>
        <GuideWorkspace key={`${selected}-${revision}`} areaId={selected} />
      </>}
    </>}
  </div>;
}