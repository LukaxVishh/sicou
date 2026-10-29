import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { downloadGuideFile, getGuideFile, previewGuideFile, type GuideDocument, type GuideItem } from './api';
import { SystemLoadingState, SystemNotice } from '../../shared/components';

const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

/** Prévia do anexo dentro do sistema; o download é opcional, a partir do próprio modal. */
export function GuideFilePreview({ areaId, item, onClose }: { areaId: string; item: GuideItem; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ext = item.fileName?.split('.').pop()?.toLowerCase() ?? '';
  const [url, setUrl] = useState('');
  const [document, setDocument] = useState<GuideDocument | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    let active = true;
    let objectUrl = '';
    async function load() {
      try {
        // Sem visualizador de PDF, o iframe baixaria o arquivo automaticamente.
        if (ext === 'pdf' && navigator.pdfViewerEnabled === false) {
          setError('Este navegador não exibe PDF internamente. Use "Baixar" para abrir o arquivo.');
        } else if (ext === 'pdf' || imageTypes[ext]) {
          const blob = await getGuideFile(areaId, item.id, imageTypes[ext] ?? 'application/pdf', controller.signal);
          if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
        } else if (['docx', 'xlsx', 'csv'].includes(ext)) {
          const result = await previewGuideFile(areaId, item.id);
          if (active) setDocument(result);
        } else if (active) setError('Prévia indisponível para este formato. Você ainda pode baixar o arquivo.');
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível abrir a prévia.'); }
    }
    void load();
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [areaId, item.id, ext]);
  async function download() {
    setDownloading(true);
    try { await downloadGuideFile(areaId, item); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível baixar o arquivo.'); }
    finally { setDownloading(false); }
  }
  return <dialog ref={dialog} aria-labelledby="guide-preview-title" onClose={onClose} onClick={e => { if (e.target === dialog.current) dialog.current?.close(); }}
    className="fixed inset-0 m-auto h-[90vh] max-h-[90vh] w-[min(1100px,95vw)] max-w-none rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pré-visualização</p><h2 id="guide-preview-title" className="truncate font-semibold" title={item.fileName ?? ''}>{item.fileName}</h2></div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" disabled={downloading} onClick={() => void download()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50">
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Baixar
          </button>
          <button autoFocus type="button" aria-label="Fechar pré-visualização" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => dialog.current?.close()}><X size={20} /></button>
        </div>
      </header>
      {error ? <div className="p-6"><SystemNotice tone={document || url ? 'error' : 'info'}>{error}</SystemNotice></div>
        : url ? (imageTypes[ext] ? <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-50 p-4"><img src={url} alt={item.fileName ?? 'Anexo'} className="max-h-full max-w-full object-contain" /></div>
          : <iframe title={`Pré-visualização de ${item.fileName}`} src={url} className="min-h-0 flex-1 border-0" />)
        : document ? <div className="min-h-0 flex-1 overflow-auto p-6">
          <p className="mb-4 text-sm text-slate-500">Prévia do conteúdo. Formatação original, imagens e gráficos do Office podem não aparecer; baixe o arquivo para vê-lo completo.</p>
          {document.warnings.map((warning, i) => <p key={i} className="mb-2 text-sm text-amber-800">{warning}</p>)}
          {!document.tables.length || ext === 'docx' ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{document.text || 'Nenhum texto disponível.'}</p> : null}
          {document.tables.map((table, i) => <section key={i} className="mt-6"><h3 className="mb-2 font-semibold">{table.name}</h3><div className="overflow-auto"><table className="border-collapse text-sm"><tbody>{table.rows.map((row, r) => <tr key={r} className={r === 0 ? 'bg-slate-50 font-semibold' : ''}>{row.map((cell, c) => <td key={c} className="min-w-24 max-w-96 whitespace-pre-wrap break-words border border-slate-200 p-2 align-top">{cell}</td>)}</tr>)}</tbody></table></div></section>)}
        </div>
        : <SystemLoadingState label="Abrindo documento..." className="flex-1" />}
    </div>
  </dialog>;
}
