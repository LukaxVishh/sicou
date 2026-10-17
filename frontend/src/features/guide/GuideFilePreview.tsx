import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getGuidePdf, previewGuideFile, type GuideDocument, type GuideItem } from './api';

export function GuideFilePreview({ areaId, item, onClose }: { areaId: string; item: GuideItem; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState('');
  const [document, setDocument] = useState<GuideDocument | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    let active = true;
    let objectUrl = '';
    async function load() {
      try {
        const ext = item.fileName?.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') {
          const blob = await getGuidePdf(areaId, item.id, controller.signal);
          if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
        } else if (['docx', 'xlsx', 'csv'].includes(ext ?? '')) {
          const result = await previewGuideFile(areaId, item.id);
          if (active) setDocument(result);
        } else if (active) setError('Prévia indisponível para este formato. Solicite ao gestor uma versão PDF, DOCX ou XLSX.');
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível abrir a prévia.'); }
    }
    void load();
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [areaId, item.id, item.fileName]);
  return <dialog ref={dialog} aria-labelledby="guide-preview-title" onClose={onClose} className="fixed inset-0 m-auto h-[90vh] max-h-[90vh] w-[min(1100px,95vw)] max-w-none rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4"><h2 id="guide-preview-title" className="min-w-0 break-words font-semibold">{item.fileName}</h2><button autoFocus type="button" aria-label="Fechar visualização" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => dialog.current?.close()}><X /></button></header>
      {error ? <p role="alert" className="p-6 text-rose-700">{error}</p> : url ? <iframe title={`Visualização de ${item.fileName}`} src={url} className="min-h-0 flex-1 border-0" /> : document ? <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-4 text-sm text-slate-500">Prévia de conteúdo. A formatação original, imagens e gráficos do Office podem não aparecer.</p>
        {document.warnings.map((warning, i) => <p key={i} className="mb-2 text-sm text-amber-800">{warning}</p>)}
        {!document.tables.length || item.fileName?.toLowerCase().endsWith('.docx') ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{document.text || 'Nenhum texto disponível.'}</p> : null}
        {document.tables.map((table, i) => <section key={i} className="mt-6"><h3 className="mb-2 font-semibold">{table.name}</h3><div className="overflow-auto"><table className="border-collapse text-sm"><tbody>{table.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className="min-w-24 max-w-96 whitespace-pre-wrap break-words border border-slate-200 p-2 align-top">{cell}</td>)}</tr>)}</tbody></table></div></section>)}
      </div> : <p role="status" className="p-6">Abrindo documento...</p>}
    </div>
  </dialog>;
}
