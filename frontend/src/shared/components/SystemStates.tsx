import { AlertCircle, CheckCircle2, Inbox, Info, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type NoticeTone = 'error' | 'success' | 'warning' | 'info';

const noticeStyles: Record<NoticeTone, { frame: string; icon: string; Icon: LucideIcon }> = {
  error: { frame: 'border-rose-200 bg-rose-50 text-rose-900', icon: 'text-rose-600', Icon: AlertCircle },
  success: { frame: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: 'text-emerald-600', Icon: CheckCircle2 },
  warning: { frame: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-600', Icon: AlertCircle },
  info: { frame: 'border-indigo-200 bg-indigo-50 text-indigo-900', icon: 'text-indigo-600', Icon: Info },
};

export function SystemNotice({
  tone = 'error',
  title,
  children,
  className = '',
}: {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const style = noticeStyles[tone];
  const Icon = style.Icon;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-5 ${style.frame} ${className}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}

export function SystemEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className = '',
  compact = false,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-5 py-8' : 'px-6 py-12'} ${className}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1.5 max-w-lg text-sm leading-5 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SystemLoadingState({
  label,
  className = '',
  compact = false,
}: {
  label: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2.5 text-sm text-slate-500 ${compact ? 'px-4 py-6' : 'px-6 py-10'} ${className}`}>
      <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
