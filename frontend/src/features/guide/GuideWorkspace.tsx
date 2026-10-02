import { useEffect, useState, type FormEvent } from 'react';
import { Download, ExternalLink, Plus, Search } from 'lucide-react';
import { downloadGuideFile, getGuide, mutateGuide, uploadGuideFile, type GuideCategory, type GuideData, type GuideItem } from './api';

const input = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50';
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
  return <section className="space-y-4" aria-label="Orientações da área" aria-busy={busy}>
    {error && <div role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</div>}
    {!data && !error && <p role="status">Carregando orientações...</p>}
    {data && <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm"><span className="flex items-center gap-2"><Search size={16} /> Buscar orientação</span><input className={input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Título, conteúdo, categoria ou anexo" /></label>
        <label className="text-sm">Categoria<select className={input} value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {data.canManage && <label className="text-sm">Publicação<select className={input} value={publication} onChange={e => setPublication(e.target.value)}><option value="">Todas</option><option value="published">Publicadas</option><option value="draft">Rascunhos</option></select></label>}
        {data.canManage && <><button className={button} disabled={busy} onClick={() => { setCategoryForm({ name: '', sortOrder: 0 }); setItemForm(null); }}>Nova categoria</button>
          <button className={button} disabled={busy || !data.categories.length} onClick={() => { setItemForm({ ...emptyItem, categoryId: category || data.categories[0].id }); setCategoryForm(null); setFile(null); }}><Plus className="mr-1 inline h-4 w-4" />Nova orientação</button></>}
      </div>
      {data.canManage && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-medium">Gerenciar categorias ({data.categories.length})</summary>
        {!data.categories.length && <p className="mt-3 text-sm text-slate-500">Crie a primeira categoria para adicionar orientações.</p>}
        {data.categories.map(c => <div key={c.id} className="mt-3 flex flex-wrap items-center gap-2"><span className="flex-1">{c.name}</span><button className={button} disabled={busy} onClick={() => { setCategoryForm(c); setItemForm(null); }}>Editar</button><button className={button} disabled={busy} onClick={() => setConfirmation({ path: `categories/${c.id}`, label: c.name })}>Excluir</button></div>)}
      </details>}
      {data.canManage && categoryForm && <form onSubmit={saveCategory} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">{categoryForm.id ? 'Editar categoria' : 'Nova categoria'}</h2>
        <label className="block text-sm">Nome<input className={input} required maxLength={150} value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} /></label>
        <label className="block text-sm">Ordem<input className={input} type="number" min={0} max={100000} required value={categoryForm.sortOrder} onChange={e => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })} /></label>
        <button className={button} disabled={busy}>Salvar categoria</button> <button type="button" className={button} disabled={busy} onClick={() => setCategoryForm(null)}>Cancelar</button>
      </form>}
      {data.canManage && itemForm && <form onSubmit={saveItem} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">{itemForm.id ? 'Editar orientação' : 'Nova orientação'}</h2>
        <label className="block text-sm">Título<input className={input} required maxLength={200} value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} /></label>
        <label className="block text-sm">Categoria<select className={input} required value={itemForm.categoryId} onChange={e => setItemForm({ ...itemForm, categoryId: e.target.value })}>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-sm">Instruções<textarea className={input} rows={7} maxLength={50000} value={itemForm.content} onChange={e => setItemForm({ ...itemForm, content: e.target.value })} /></label>
        <label className="block text-sm">Link (opcional)<input className={input} type="url" maxLength={2048} placeholder="https://" value={itemForm.url} onChange={e => setItemForm({ ...itemForm, url: e.target.value })} /></label>
        <label className="block text-sm">Ordem<input className={input} type="number" min={0} max={100000} required value={itemForm.sortOrder} onChange={e => setItemForm({ ...itemForm, sortOrder: Number(e.target.value) })} /></label>
        <label className="block text-sm">Anexo (até 10 MB; substitui o atual)<input className={input} type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemForm.isPublished} onChange={e => setItemForm({ ...itemForm, isPublished: e.target.checked })} />Publicar para consulta</label>
        <button className={button} disabled={busy}>{busy ? 'Salvando...' : 'Salvar orientação'}</button> <button className={button} type="button" disabled={busy} onClick={() => { setItemForm(null); setFile(null); }}>Cancelar</button>
      </form>}
      {confirmation && <div role="alertdialog" aria-label="Confirmar exclusão" className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p>Excluir “{confirmation.label}”? Esta ação é permanente.</p><div className="mt-3 flex gap-2"><button className={button} disabled={busy} onClick={() => void run(async () => {
        await mutateGuide(areaId, confirmation.path, 'DELETE');
        if (confirmation.path === `categories/${category}`) setCategory('');
        if (confirmation.path === `categories/${categoryForm?.id}`) setCategoryForm(null);
        if (confirmation.path === `items/${itemForm?.id}`) { setItemForm(null); setFile(null); }
        setConfirmation(null);
      })}>Confirmar exclusão</button><button className={button} disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button></div></div>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500"><p role="status">{visible.length} de {data.items.length} orientações</p>{(query || category || publication) && <button className={button} onClick={() => { setQuery(''); setCategory(''); setPublication(''); }}>Limpar filtros</button>}</div>
      {!visible.length && <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Nenhuma orientação encontrada.</p>}
      <div className="grid gap-4 lg:grid-cols-2">{visible.map(item => <article key={item.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap gap-2 text-xs font-medium text-amber-800"><span>{data.categories.find(c => c.id === item.categoryId)?.name}</span>{!item.isPublished && <span className="rounded bg-slate-100 px-2 text-slate-600">Rascunho</span>}</div>
        <h2 className="mt-2 break-words text-lg font-semibold text-slate-900">{item.title}</h2>
        <p className="mt-1 text-xs text-slate-400">Atualizado em {new Date(item.updatedAt ?? item.createdAt).toLocaleDateString('pt-BR')}</p>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{item.content}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {item.url && /^https?:\/\//i.test(item.url) && <a className={button} href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} className="mr-2 inline" />Abrir link</a>}
          {item.fileName && <button className={button} disabled={busy} onClick={() => void run(() => downloadGuideFile(areaId, item), false)}><Download size={14} className="mr-2 inline" />{item.fileName}</button>}
        </div>
        {data.canManage && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button className={button} disabled={busy} onClick={() => { setItemForm({ ...item, url: item.url ?? '' }); setCategoryForm(null); setFile(null); }}>Editar</button><button className={button} disabled={busy || itemForm?.id === item.id} onClick={() => void run(async () => {
          await mutateGuide(areaId, `items/${item.id}`, 'PUT', { ...item, isPublished: !item.isPublished });
        })}>{item.isPublished ? 'Despublicar' : 'Publicar'}</button><button className={button} disabled={busy} onClick={() => setConfirmation({ path: `items/${item.id}`, label: item.title })}>Excluir</button>{item.fileName && <button className={button} disabled={busy} onClick={() => setConfirmation({ path: `items/${item.id}/file`, label: item.fileName! })}>Remover anexo</button>}</div>}
      </article>)}</div>
    </>}
  </section>;
}
