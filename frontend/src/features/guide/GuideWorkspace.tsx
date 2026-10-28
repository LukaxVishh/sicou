import { NativeSelectDropdown } from '../../shared/components/NativeSelectDropdown';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Download, ExternalLink, FolderOpen, Home, Link2, Paperclip, Plus, Search } from 'lucide-react';
import { downloadGuideFile, getGuide, mutateGuide, uploadGuideFile, type GuideCategory, type GuideData, type GuideItem } from './api';
import { SystemEmptyState, SystemLoadingState, SystemNotice } from '../../shared/components';
import { cn } from '../../shared/utils';

/** Duração da saída do grid (deve casar com .guide-grid-leave em index.css). */
const LEAVE_MS = 170;
/** Atraso entre a entrada de cada bloco; limitado para listas longas não demorarem. */
const stagger = (index: number): CSSProperties => ({ animationDelay: `${Math.min(index, 14) * 35}ms` });
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const block = 'guide-block-enter group flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 active:translate-y-0 active:scale-[0.99]';

const input = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const button = 'inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
const emptyItem = { categoryId: '', title: '', content: '', url: '', sortOrder: 0, isPublished: false };
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function GuideWorkspace({ areaId }: { areaId: string }) {
  const [data, setData] = useState<GuideData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [publication, setPublication] = useState('');
  const [itemForm, setItemForm] = useState<(typeof emptyItem & { id?: string }) | null>(null);
  const [categoryForm, setCategoryForm] = useState<{ id?: string; name: string; sortOrder: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState<{ path: string; label: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [viewKey, setViewKey] = useState(0);
  const leaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  /** Troca de nível com a mesma coreografia do vídeo: grid atual sai (fade + desce), novo grid entra em cascata. */
  function navigate(next: string, clearQuery = false) {
    if (leaving) return;
    const apply = () => {
      setCategory(next);
      if (clearQuery) setQuery('');
      setExpanded(null);
      setLeaving(false);
      setViewKey(k => k + 1);
    };
    if (prefersReducedMotion()) { apply(); return; }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(apply, LEAVE_MS);
  }
  useEffect(() => {
    let active = true;
    getGuide(areaId).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar orientações.'); });
    return () => { active = false; };
  }, [areaId]);
  async function run(action: () => Promise<void>, refresh = true) {
    setBusy(true); setError('');
    try { await action(); if (refresh) setData(await getGuide(areaId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a operação.'); }
    finally { setBusy(false); }
  }
  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!itemForm) return;
    if (file && (file.size === 0 || file.size > 10 * 1024 * 1024)) { setError('Selecione um arquivo de até 10 MB, não vazio.'); return; }
    await run(async () => {
      const saved = await mutateGuide<GuideItem>(areaId, itemForm.id ? `items/${itemForm.id}` : 'items', itemForm.id ? 'PUT' : 'POST', itemForm);
      setItemForm({ ...itemForm, id: saved.id });
      setData(previous => previous && {
        ...previous, items: previous.items.some(i => i.id === saved.id)
          ? previous.items.map(i => i.id === saved.id ? saved : i) : [...previous.items, saved]
      });
      if (file) await uploadGuideFile(areaId, saved.id, file);
      setItemForm(null); setFile(null);
    });
  }
  async function saveCategory(e: FormEvent) {
    e.preventDefault();
    if (!categoryForm) return;
    await run(async () => {
      await mutateGuide<GuideCategory>(areaId, categoryForm.id ? `categories/${categoryForm.id}` : 'categories', categoryForm.id ? 'PUT' : 'POST', categoryForm);
      setCategoryForm(null);
    });
  }
  const visible = data?.items.filter(i => (!category || i.categoryId === category) &&
    (!publication || (publication === 'published' ? i.isPublished : !i.isPublished)) &&
    normalizeSearch(`${i.title} ${i.content} ${i.fileName ?? ''} ${data.categories.find(c => c.id === i.categoryId)?.name ?? ''}`).includes(normalizeSearch(query))) ?? [];
  const searching = normalizeSearch(query).length > 0;
  const showItems = Boolean(category) || searching;
  const currentCategory = data?.categories.find(c => c.id === category);
  const countIn = (categoryId: string) => data?.items.filter(i => i.categoryId === categoryId &&
    (!publication || (publication === 'published' ? i.isPublished : !i.isPublished))).length ?? 0;
  const scopeTotal = category ? (data?.items.filter(i => i.categoryId === category).length ?? 0) : (data?.items.length ?? 0);
  const rootCategories = data?.categories.filter(c => data.canManage || countIn(c.id) > 0) ?? [];
  return <section className="space-y-4" aria-label="Orientações da área" aria-busy={busy}>
    {error && <SystemNotice>{error}</SystemNotice>}
    {!data && !error && <SystemLoadingState label="Carregando orientações..." />}
    {data && <>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <label className="min-w-48 flex-1 text-sm"><span className="flex items-center gap-2"><Search size={16} /> Buscar orientação</span><input className={input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Título, conteúdo, categoria ou anexo" /></label>
        {data.canManage && <label className="text-sm">Publicação<NativeSelectDropdown className={input} value={publication} onChange={e => setPublication(e.target.value)}><option value="">Todas</option><option value="published">Publicadas</option><option value="draft">Rascunhos</option></NativeSelectDropdown></label>}
        {data.canManage && <><button className={button} disabled={busy} onClick={() => { setCategoryForm({ name: '', sortOrder: 0 }); setItemForm(null); }}>Nova categoria</button>
          <button className={button} disabled={busy || !data.categories.length} onClick={() => { setItemForm({ ...emptyItem, categoryId: category || data.categories[0].id }); setCategoryForm(null); setFile(null); }}><Plus className="mr-1 inline h-4 w-4" />Nova orientação</button></>}
      </div>
      {data.canManage && <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><summary className="cursor-pointer font-semibold text-slate-800 marker:text-indigo-500">Gerenciar categorias ({data.categories.length})</summary>
        {!data.categories.length && <p className="mt-3 text-sm text-slate-500">Crie a primeira categoria para adicionar orientações.</p>}
        {data.categories.map(c => <div key={c.id} className="mt-3 flex flex-wrap items-center gap-2"><span className="flex-1">{c.name}</span><button className={button} disabled={busy} onClick={() => { setCategoryForm(c); setItemForm(null); }}>Editar</button><button className={button} disabled={busy} onClick={() => setConfirmation({ path: `categories/${c.id}`, label: c.name })}>Excluir</button></div>)}
      </details>}
      {data.canManage && categoryForm && <form onSubmit={saveCategory} className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5"><h2 className="font-semibold text-slate-900">{categoryForm.id ? 'Editar categoria' : 'Nova categoria'}</h2>
        <label className="block text-sm">Nome<input className={input} required maxLength={150} value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} /></label>
        <label className="block text-sm">Ordem<input className={input} type="number" min={0} max={100000} required value={categoryForm.sortOrder} onChange={e => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })} /></label>
        <button className={button} disabled={busy}>Salvar categoria</button> <button type="button" className={button} disabled={busy} onClick={() => setCategoryForm(null)}>Cancelar</button>
      </form>}
      {data.canManage && itemForm && <form onSubmit={saveItem} className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5"><h2 className="font-semibold text-slate-900">{itemForm.id ? 'Editar orientação' : 'Nova orientação'}</h2>
        <label className="block text-sm">Título<input className={input} required maxLength={200} value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} /></label>
        <label className="block text-sm">Categoria<NativeSelectDropdown className={input} required value={itemForm.categoryId} onChange={e => setItemForm({ ...itemForm, categoryId: e.target.value })}>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelectDropdown></label>
        <label className="block text-sm">Instruções<textarea className={input} rows={7} maxLength={50000} value={itemForm.content} onChange={e => setItemForm({ ...itemForm, content: e.target.value })} /></label>
        <label className="block text-sm">Link (opcional)<input className={input} type="url" maxLength={2048} placeholder="https://" value={itemForm.url} onChange={e => setItemForm({ ...itemForm, url: e.target.value })} /></label>
        <label className="block text-sm">Ordem<input className={input} type="number" min={0} max={100000} required value={itemForm.sortOrder} onChange={e => setItemForm({ ...itemForm, sortOrder: Number(e.target.value) })} /></label>
        <label className="block text-sm">Anexo (até 10 MB; substitui o atual)<input className={input} type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemForm.isPublished} onChange={e => setItemForm({ ...itemForm, isPublished: e.target.checked })} />Publicar para consulta</label>
        <button className={button} disabled={busy}>{busy ? 'Salvando...' : 'Salvar orientação'}</button> <button className={button} type="button" disabled={busy} onClick={() => { setItemForm(null); setFile(null); }}>Cancelar</button>
      </form>}
      {confirmation && <div role="alertdialog" aria-label="Confirmar exclusão" className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="font-medium text-rose-900">Excluir “{confirmation.label}”? Esta ação é permanente.</p><div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void run(async () => {
        await mutateGuide(areaId, confirmation.path, 'DELETE');
        if (confirmation.path === `categories/${category}`) setCategory('');
        if (confirmation.path === `categories/${categoryForm?.id}`) setCategoryForm(null);
        if (confirmation.path === `items/${itemForm?.id}`) { setItemForm(null); setFile(null); }
        setConfirmation(null);
      })}>Confirmar exclusão</button><button className={button} disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button></div></div>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <nav aria-label="Navegação do Orientador" className="flex min-h-9 min-w-0 flex-wrap items-center gap-1.5 text-slate-500">
          {showItems && <button type="button" className="guide-block-enter mr-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50" disabled={leaving} onClick={() => navigate('', true)}><ArrowLeft size={14} />Voltar</button>}
          <button type="button" className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition', showItems ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800' : 'cursor-default text-slate-800')} disabled={!showItems || leaving} onClick={() => navigate('', true)}><Home size={14} />Categorias</button>
          {showItems && <><ChevronRight size={14} className="shrink-0 text-slate-300" /><span key={`${category}-${searching}`} className="guide-block-enter truncate text-xs font-semibold text-slate-800">{currentCategory?.name ?? 'Resultados da busca'}{currentCategory && searching && ' · busca'}</span></>}
        </nav>
        <div className="flex items-center gap-2 text-slate-500"><p role="status">{showItems ? `${visible.length} de ${scopeTotal} ${scopeTotal === 1 ? 'orientação' : 'orientações'}` : `${data.categories.length} ${data.categories.length === 1 ? 'categoria' : 'categorias'}`}</p>{(query || publication) && <button className={button} onClick={() => { setQuery(''); setPublication(''); }}>Limpar filtros</button>}</div>
      </div>
      {!showItems && !rootCategories.length && <SystemEmptyState className="rounded-2xl border border-dashed border-slate-300 bg-white" compact title="Nenhuma orientação disponível" description={data.canManage ? 'Crie a primeira categoria para organizar as orientações desta área.' : 'Esta área ainda não publicou orientações.'} />}
      {showItems && !visible.length && <SystemEmptyState className="rounded-2xl border border-dashed border-slate-300 bg-white" compact title="Nenhuma orientação encontrada" description="Revise os filtros ou cadastre uma orientação para esta área." />}
      <div key={viewKey} className={cn('grid items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3', leaving && 'guide-grid-leave')}>
        {!showItems ? rootCategories.map((c, index) => {
          const total = countIn(c.id);
          return <button key={c.id} type="button" className={block} style={stagger(index)} disabled={leaving} onClick={() => navigate(c.id)}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100"><FolderOpen size={18} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-800">{c.name}</span><span className="text-xs text-slate-500">{total} {total === 1 ? 'orientação' : 'orientações'}</span></span>
            <ChevronRight size={18} className="shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500" />
          </button>;
        }) : visible.map((item, index) => {
          const open = expanded === item.id;
          const categoryName = data.categories.find(c => c.id === item.categoryId)?.name;
          return <article key={item.id} style={stagger(index)} className={cn('guide-block-enter min-w-0 rounded-xl border bg-white shadow-sm transition-[border-color,box-shadow] duration-200', open ? 'border-indigo-200 shadow-md' : 'border-slate-200 hover:border-indigo-200 hover:shadow-md')}>
            <button type="button" aria-expanded={open} aria-controls={`guide-item-${item.id}`} className="group flex min-h-16 w-full items-center gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200" onClick={() => setExpanded(open ? null : item.id)}>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words font-semibold leading-snug text-slate-800">{item.title}</span>
                {((!category && categoryName) || !item.isPublished) && <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">{!category && categoryName && <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">{categoryName}</span>}{!item.isPublished && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">Rascunho</span>}</span>}
              </span>
              {item.url && <Link2 size={15} className="shrink-0 text-slate-400" aria-label="Possui link" />}
              {item.fileName && <Paperclip size={15} className="shrink-0 text-slate-400" aria-label="Possui anexo" />}
              <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform duration-300 group-hover:text-indigo-500', open && 'rotate-180 text-indigo-500')} />
            </button>
            <div id={`guide-item-${item.id}`} inert={!open} className={cn('grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="min-h-0 overflow-hidden">
                <div className={cn('border-t border-slate-100 px-4 pb-4 pt-3 transition-[opacity,transform] duration-300 ease-out', open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0')}>
                  <p className="text-xs text-slate-400">Atualizado em {new Date(item.updatedAt ?? item.createdAt).toLocaleDateString('pt-BR')}</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{item.content}</p>
                  {(item.fileName || (item.url && /^https?:\/\//i.test(item.url))) && <div className="mt-4 flex flex-wrap gap-3">
                    {item.url && /^https?:\/\//i.test(item.url) && <a className={button} href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} className="mr-2 inline" />Abrir link</a>}
                    {item.fileName && <button className={button} disabled={busy} onClick={() => void run(() => downloadGuideFile(areaId, item), false)}><Download size={14} className="mr-2 inline" />{item.fileName}</button>}
                  </div>}
                  {data.canManage && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button className={button} disabled={busy} onClick={() => { setItemForm({ ...item, url: item.url ?? '' }); setCategoryForm(null); setFile(null); }}>Editar</button><button className={button} disabled={busy || itemForm?.id === item.id} onClick={() => void run(async () => {
                    await mutateGuide(areaId, `items/${item.id}`, 'PUT', { ...item, isPublished: !item.isPublished });
                  })}>{item.isPublished ? 'Despublicar' : 'Publicar'}</button><button className={button} disabled={busy} onClick={() => setConfirmation({ path: `items/${item.id}`, label: item.title })}>Excluir</button>{item.fileName && <button className={button} disabled={busy} onClick={() => setConfirmation({ path: `items/${item.id}/file`, label: item.fileName! })}>Remover anexo</button>}</div>}
                </div>
              </div>
            </div>
          </article>;
        })}
      </div>
    </>}
  </section>;
}
