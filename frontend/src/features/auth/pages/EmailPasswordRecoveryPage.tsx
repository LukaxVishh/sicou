import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { apiFetch } from '../../../shared/api';
import { SystemNotice } from '../../../shared/components';

export function EmailPasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const linkEmail = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const invalidLink = reset && (!token || !linkEmail);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (reset && password !== confirmation) { setError('A confirmação deve ser igual à nova senha.'); return; }
    setBusy(true);
    try {
      const response = await apiFetch<{ message: string }>(reset ? '/api/auth/reset-password' : '/api/auth/forgot-password', {
        method: 'POST', auth: false,
        body: JSON.stringify(reset ? { email: linkEmail, token, newPassword: password } : { email }),
      });
      setMessage(response.message); setPassword(''); setConfirmation('');
      if (reset) navigate('/reset-password', { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir a solicitação.'); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#eef2ff_0%,_#f8fafc_50%,_#f1f5f9_100%)] px-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-8">
      <img
        src="/logos/separadas/logo-sicou-horizontal.png"
        alt="Sicou — Governança Operacional"
        className="mb-6 h-auto w-48 max-w-full object-contain"
      />
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{reset ? 'Definir nova senha' : 'Recuperar senha'}</h1>
      <p className="mt-3 text-sm text-slate-600">{reset ? 'Confirme a recuperação escolhendo sua nova senha de acesso.' : 'Informe o e-mail cadastrado. Você receberá um link para definir uma nova senha, válido por 30 minutos.'}</p>
      {message ? <SystemNotice tone="success" className="mt-6">{message}</SystemNotice>
        : invalidLink ? <SystemNotice className="mt-6">Link incompleto. Abra o link recebido por e-mail ou solicite uma nova recuperação.</SystemNotice>
        : <form onSubmit={submit} className="mt-6 space-y-4">
          {reset ? <>
            <p className="break-words text-sm text-slate-600">{linkEmail}</p>
            <label className="block text-sm">Nova senha<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
            <p className="text-xs text-slate-500">Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.</p>
            <label className="block text-sm">Confirme a nova senha<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
          </> : <label className="block text-sm">E-mail cadastrado<input type="email" autoComplete="email" required maxLength={256} value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>}
          {error && <SystemNotice>{error}</SystemNotice>}
          <button disabled={busy} className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Aguarde...' : reset ? 'Confirmar e salvar nova senha' : 'Enviar link de recuperação'}</button>
        </form>}
      {reset && !message && <Link to="/forgot-password" className="mt-5 block text-sm text-indigo-700 underline">Solicitar um novo link</Link>}
      <Link to="/login" className="mt-5 block text-sm text-slate-600 underline">Voltar ao login</Link>
    </section>
  </main>;
}
