import { Bell, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../shared/api';
import { useAuth } from '../auth/providers';

type Notification = { id: string; title: string; url: string; createdAt: string; readAt: string | null };
type NotificationPage = { items: Notification[]; unreadCount: number; totalCount: number; page: number; pageSize: number };

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const requestGeneration = ++generation.current;
    try {
      const next = await apiFetch<NotificationPage>(`/api/notifications?page=${page}`, { signal });
      if (!signal?.aborted && requestGeneration === generation.current) { setData(next); setError(''); }
    } catch (err) {
      if (!signal?.aborted && requestGeneration === generation.current) setError(err instanceof Error ? err.message : 'Falha ao carregar notificações.');
    }
  }, [page]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    const interval = window.setInterval(() => { if (!document.hidden) void load(controller.signal); }, 30000);
    return () => { controller.abort(); window.clearTimeout(timer); window.clearInterval(interval); };
  }, [load, user?.id]);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: MouseEvent) { if (event.target instanceof Node && !panel.current?.contains(event.target)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);
  async function read(notification?: Notification) {
    setBusy(true);
    try {
      await apiFetch(notification ? `/api/notifications/${notification.id}/read` : '/api/notifications/read-all', { method: 'PUT' });
      await load();
      if (notification) { setOpen(false); navigate(notification.url); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível marcar como lida.'); }
    finally { setBusy(false); }
  }
  return <div ref={panel} className="relative">
    <button onClick={() => { setOpen(v => !v); void load(); }} aria-label={`Notificações${data?.unreadCount ? `: ${data.unreadCount} não lidas` : ''}`} aria-expanded={open} aria-controls="notification-panel" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
      <Bell className="h-5 w-5" />{!!data?.unreadCount && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{data.unreadCount > 99 ? '99+' : data.unreadCount}</span>}
    </button>
    {open && <section id="notification-panel" aria-label="Notificações" className="fixed left-4 right-4 top-20 z-50 rounded-xl border bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
      <div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold">Notificações</h2><button aria-label="Fechar notificações" onClick={() => setOpen(false)}><X size={18} /></button></div>
      {!!data?.unreadCount && <button disabled={busy} onClick={() => void read()} className="p-3 text-sm text-indigo-700 disabled:opacity-50">Marcar todas como lidas</button>}
      {error && <p role="alert" className="p-3 text-sm text-red-700">{error}<button onClick={() => void load()} className="ml-2 underline">Tentar novamente</button></p>}
      <ul className="max-h-80 overflow-y-auto divide-y">
        {data?.items.map(n => <li key={n.id}><button disabled={busy} onClick={() => void read(n)} className={`w-full p-4 text-left disabled:opacity-50 ${n.readAt ? 'bg-white' : 'bg-indigo-50'}`}><p className="text-sm font-medium">{!n.readAt && <span aria-label="Não lida" className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-600" />}{n.title}</p><time className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleString('pt-BR')}</time></button></li>)}
        {!data && !error && <li className="p-5 text-sm">Carregando...</li>}
        {data && !data.items.length && <li className="p-5 text-sm text-slate-500">Nenhuma notificação.</li>}
      </ul>
      {data && data.totalCount > data.pageSize && <div className="flex items-center justify-between border-t p-3 text-sm"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page}</span><button disabled={page * data.pageSize >= data.totalCount} onClick={() => setPage(p => p + 1)}>Próxima</button></div>}
    </section>}
  </div>;
}
