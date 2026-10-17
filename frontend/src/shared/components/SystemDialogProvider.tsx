import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Info,
  X,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type DialogTone = 'neutral' | 'danger' | 'success' | 'info';

type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type DialogRequest = {
  kind: 'alert' | 'confirm';
  message: string;
  options: DialogOptions;
  resolve: (confirmed: boolean) => void;
};

type SystemDialogContextValue = {
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
  showAlert: (message: string, options?: DialogOptions) => Promise<void>;
};

const SystemDialogContext = createContext<SystemDialogContextValue | null>(null);

const toneStyles: Record<DialogTone, { icon: typeof Info; iconClass: string; confirmClass: string }> = {
  neutral: {
    icon: CircleHelp,
    iconClass: 'bg-indigo-50 text-indigo-600',
    confirmClass: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500',
  },
  danger: {
    icon: AlertTriangle,
    iconClass: 'bg-rose-50 text-rose-600',
    confirmClass: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'bg-emerald-50 text-emerald-600',
    confirmClass: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
  },
  info: {
    icon: Info,
    iconClass: 'bg-sky-50 text-sky-600',
    confirmClass: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500',
  },
};

export function SystemDialogProvider({ children }: { children: ReactNode }) {
  const [activeDialog, setActiveDialog] = useState<DialogRequest | null>(null);
  const activeRef = useRef<DialogRequest | null>(null);
  const queueRef = useRef<DialogRequest[]>([]);

  const enqueue = useCallback((request: DialogRequest) => {
    if (activeRef.current) {
      queueRef.current.push(request);
      return;
    }
    activeRef.current = request;
    setActiveDialog(request);
  }, []);

  const confirm = useCallback((message: string, options: DialogOptions = {}) =>
    new Promise<boolean>((resolve) => enqueue({ kind: 'confirm', message, options, resolve })), [enqueue]);

  const showAlert = useCallback((message: string, options: DialogOptions = {}) =>
    new Promise<void>((resolve) => enqueue({
      kind: 'alert',
      message,
      options,
      resolve: () => resolve(),
    })), [enqueue]);

  const settle = useCallback((confirmed: boolean) => {
    const current = activeRef.current;
    if (!current) return;
    current.resolve(confirmed);
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActiveDialog(next);
  }, []);

  const value = { confirm, showAlert };
  const tone = activeDialog?.options.tone ?? (activeDialog?.kind === 'alert' ? 'info' : 'neutral');
  const style = toneStyles[tone];
  const Icon = style.icon;

  return (
    <SystemDialogContext.Provider value={value}>
      {children}
      {activeDialog && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && activeDialog.kind === 'alert') settle(true);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sicou-dialog-title"
            aria-describedby="sicou-dialog-message"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
            onKeyDown={(event) => {
              if (event.key === 'Escape') settle(false);
            }}
          >
            <div className="flex items-start gap-4 p-5 sm:p-6">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="sicou-dialog-title" className="text-base font-semibold text-slate-950">
                  {activeDialog.options.title ?? (activeDialog.kind === 'confirm' ? 'Confirme esta ação' : 'Aviso')}
                </h2>
                <p id="sicou-dialog-message" className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {activeDialog.message}
                </p>
              </div>
              {activeDialog.kind === 'alert' && (
                <button type="button" onClick={() => settle(true)} className="-mr-2 -mt-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar aviso">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {activeDialog.kind === 'confirm' && (
                <button type="button" autoFocus onClick={() => settle(false)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  {activeDialog.options.cancelLabel ?? 'Cancelar'}
                </button>
              )}
              <button type="button" onClick={() => settle(true)} className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${style.confirmClass}`}>
                {activeDialog.options.confirmLabel ?? (activeDialog.kind === 'confirm' ? 'Confirmar' : 'Entendi')}
              </button>
            </div>
          </section>
        </div>
      )}
    </SystemDialogContext.Provider>
  );
}

export function useSystemDialog() {
  const context = useContext(SystemDialogContext);
  if (!context) throw new Error('useSystemDialog deve ser usado dentro de SystemDialogProvider.');
  return context;
}
