import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ExternalLink, FileText, FileSpreadsheet, File, FileType, Files, Plus, Search, Settings, X } from 'lucide-react';
import { getGuide, mutateGuide, uploadGuideFile, type GuideCategory, type GuideData, type GuideItem } from './api';

import { GuideFilePreview } from './GuideFilePreview';

const input = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50';
const emptyItem = { categoryId: '', title: '', content: '', url: '', sortOrder: 0, isPublished: false };
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

function fileIcon(item: GuideItem) {
  const ext = item.fileName?.split('.').pop()?.toLowerCase() ?? '';
  const Icon = ext === 'pdf' ? FileText : ['xlsx', 'xls', 'csv'].includes(ext) ? FileSpreadsheet : ['doc', 'docx'].includes(ext) ? FileType : item.url ? ExternalLink : File;
  const color = ext === 'pdf' ? 'text-rose-600' : ['xlsx', 'xls', 'csv'].includes(ext) ? 'text-emerald-600' : 'text-blue-600';
  return <Icon size={20} aria-label={ext.toUpperCase() || 'Arquivo'} className={`shrink-0 ${color}`} />;
}

export function GuideWorkspace({ areaId }: { areaId: string }) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [preview, setPreview] = useState<GuideItem | null>(null);
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
  const selectedItem = category ? visible.find(item => item.id === selectedItemId) : undefined;
  return <section className="space-y-4" aria-label="Orientações da área" aria-busy={busy}>
    {error && <div role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</div>}
    {preview && <GuideFilePreview areaId={areaId} item={preview} onClose={() => setPreview(null)} />}
    {data?.canManage && <div className="flex justify-end"><button type="button" className={button} aria-label="Configurar orientações deste setor" aria-expanded={managing} aria-controls="guide-management" onClick={() => { setManaging(!managing); setPublication(''); setItemForm(null); setCategoryForm(null); setConfirmation(null); }}><Settings size={20} /></button></div>}
    {!data && !error && <p role="status">Carregando orientações...</p>}
    {data && <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm"><span className="flex items-center gap-2"><Search size={16} /> Buscar orientação</span><input className={input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Título, conteúdo, categoria ou anexo" /></label>
        <label className="text-sm">Tipo de orientação<select className={input} value={category} onChange={e => { setCategory(e.target.value); setSelectedItemId(null); }}><option value="">Todas</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {data.canManage && managing && <label className="text-sm">Publicação<select className={input} value={publication} onChange={e => setPublication(e.target.value)}><option value="">Todas</option><option value="published">Publicadas</option><option value="draft">Rascunhos</option></select></label>}
      </div>
      {data.canManage && managing && <section id="guide-management" aria-label="Cadastro de orientações" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-semibold">Cadastro de orientações</h2><div className="flex flex-wrap gap-2">        {data.canManage && managing && <><button className={button} disabled={busy} onClick={() => { setCategoryForm({ name: '', sortOrder: 0 }); setItemForm(null); }}>Novo tipo</button>
          <button className={button} disabled={busy || !data.categories.length} onClick={() => { setItemForm({ ...emptyItem, categoryId: category || data.categories[0].id }); setCategoryForm(null); setFile(null); }}><Plus className="mr-1 inline h-4 w-4" />Nova orientação</button></>}
</div>
      {data.canManage && managing && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-medium">Gerenciar tipos ({data.categories.length})</summary>
        {!data.categories.length && <p className="mt-3 text-sm text-slate-500">Crie o primeiro tipo para adicionar orientações.</p>}
        {data.categories.map(c => <div key={c.id} className="mt-3 flex flex-wrap items-center gap-2"><span className="flex-1">{c.name}</span><button className={button} disabled={busy} onClick={() => { setCategoryForm(c); setItemForm(null); }}>Editar</button><button className={button} disabled={busy} onClick={() => setConfirmation({ path: `categories/${c.id}`, label: c.name })}>Excluir</button></div>)}
      </details>}
      {data.canManage && managing && categoryForm && <form onSubmit={saveCategory} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">{categoryForm.id ? 'Editar tipo' : 'Novo tipo'}</h2>
        <label className="block text-sm">Nome<input className={input} required maxLength={150} value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} /></label>
        <label className="block text-sm">Ordem<input className={input} type="number" min={0} max={100000} required value={categoryForm.sortOrder} onChange={e => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })} /></label>
        <button className={button} disabled={busy}>Salvar tipo</button> <button type="button" className={button} disabled={busy} onClick={() => setCategoryForm(null)}>Cancelar</button>
      </form>}
      {data.canManage && managing && itemForm && <form onSubmit={saveItem} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">{itemForm.id ? 'Editar orientação' : 'Nova orientação'}</h2>
        <label className="block text-sm">Título<input className={input} required maxLength={200} value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} /></label>
        <label className="block text-sm">Tipo de orientação<select className={input} required value={itemForm.categoryId} onChange={e => setItemForm({ ...itemForm, categoryId: e.target.value })}>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
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
      <div className="space-y-3">{visible.map(item => <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-medium">{item.title}</h3>        {data.canManage && managing && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button className={button} disabled={busy} onClick={() => { setItemForm({ ...item, url: item.url ?? '' }); setCategoryForm(null); setFile(null); }}>Editar</button><button className={button} disabled={busy || itemForm?.id === item.id} onClick={() => void run(async () => {
          await mutateGuide(areaId, `items/${item.id}`, 'PUT', { ...item, isPublished: !item.isPublished });
        })}>{item.isPublished ? 'Despublicar' : 'Publicar'}</button><button className={button} disabled={busy} onClick={() => setConfirmation({ path: `items/${item.id}`, label: item.title })}>Excluir</button>{item.fileName && <button className={button} disabled={busy} onClick={() => setConfirmation({ path: `items/${item.id}/file`, label: item.fileName! })}>Remover anexo</button>}</div>}
</div>)}</div>
      </section>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500"><p role="status">{visible.length} de {data.items.length} orientações</p>{(query || category || publication) && <button className={button} onClick={() => { setQuery(''); setCategory(''); setPublication(''); }}>Limpar filtros</button>}</div>
      {!category ? <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start gap-2" aria-label="Tipos de orientação">{data.categories.map(type => {
        const count = visible.filter(item => item.categoryId === type.id).length;
        if (!count && (query || publication)) return null;
        return <button key={type.id} title={type.name} className="flex h-14 min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-left text-base transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600" onClick={() => { setCategory(type.id); setSelectedItemId(null); }}><Files size={20} className="shrink-0 text-amber-600" /><span className="truncate font-medium text-slate-900">{type.name}</span></button>;
      })}{!visible.length && <p className="text-slate-500">Nenhuma orientação encontrada neste setor.</p>}</div> : <>
      <div className="flex items-center gap-3"><button className={button} onClick={() => { setCategory(''); setSelectedItemId(null); }}><ChevronLeft size={16} className="mr-1 inline" />Tipos de orientação</button><h2 className="font-semibold">{data.categories.find(c => c.id === category)?.name}</h2></div>
      {!visible.length && <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Nenhuma orientação encontrada.</p>}
      <div className={selectedItem ? 'grid grid-cols-[minmax(0,1fr)_320px] items-start gap-5' : ''}>
        {selectedItem && <section id="guide-item-details" aria-labelledby="guide-item-title" className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-start gap-3 border-b border-slate-100 p-6">
            <span className="mt-1">{fileIcon(selectedItem)}</span>
            <div className="min-w-0 flex-1"><h2 id="guide-item-title" className="break-words text-xl font-semibold text-slate-900">{selectedItem.title}</h2><p className="mt-2 text-sm text-slate-500">Atualizado em {new Date(selectedItem.updatedAt ?? selectedItem.createdAt).toLocaleDateString('pt-BR')}</p></div>
            <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar detalhes da orientação" onClick={() => { document.getElementById(`guide-card-${selectedItem.id}`)?.focus(); setSelectedItemId(null); }}><X size={20} /></button>
          </header>
          <div className="space-y-5 p-6">
            {!selectedItem.isPublished && <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">Rascunho</span>}
            <p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-700">{selectedItem.content || 'Nenhuma instrução adicional.'}</p>
            <div className="flex flex-wrap gap-3">
              {selectedItem.url && /^https?:\/\//i.test(selectedItem.url) && <a className={button} href={selectedItem.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} className="mr-2 inline" />Abrir link</a>}
              {selectedItem.fileName && <button className={`${button} flex max-w-full items-center gap-2`} onClick={() => setPreview(selectedItem)}>{fileIcon(selectedItem)}<span className="min-w-0 break-words">Visualizar {selectedItem.fileName}</span></button>}
            </div>
          </div>
        </section>}
        <nav aria-label="Orientações do tipo selecionado" className={selectedItem ? 'sticky top-5 grid max-h-[75vh] min-w-0 content-start gap-2 overflow-y-auto pr-1' : 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start gap-2'}>
          {visible.map(item => <button key={item.id} id={`guide-card-${item.id}`} type="button" title={item.title} aria-pressed={selectedItem?.id === item.id} aria-controls={selectedItem ? 'guide-item-details' : undefined} onClick={() => setSelectedItemId(item.id)} className={`flex h-14 min-w-0 items-center gap-3 rounded-lg border px-4 text-left text-base font-medium transition focus-visible:outline-2 focus-visible:outline-amber-600 ${selectedItem?.id === item.id ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}>
            {fileIcon(item)}<span className="min-w-0 truncate">{item.title}</span>
          </button>)}
        </nav>
      </div></>}
    </>}
  </section>;
}
