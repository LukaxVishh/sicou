import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { apiFetch } from '../../../shared/api';

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

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-500">Sicou</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{reset ? 'Definir nova senha' : 'Recuperar senha'}</h1>
      <p className="mt-3 text-sm text-slate-600">{reset ? 'Confirme a recuperação escolhendo sua nova senha de acesso.' : 'Informe o e-mail cadastrado. Você receberá um link para definir uma nova senha, válido por 30 minutos.'}</p>
      {message ? <p role="status" className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">{message}</p>
        : invalidLink ? <p role="alert" className="mt-6 text-sm text-red-700">Link incompleto. Abra o link recebido por e-mail ou solicite uma nova recuperação.</p>
        : <form onSubmit={submit} className="mt-6 space-y-4">
          {reset ? <>
            <p className="break-words text-sm text-slate-600">{linkEmail}</p>
            <label className="block text-sm">Nova senha<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <p className="text-xs text-slate-500">Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.</p>
            <label className="block text-sm">Confirme a nova senha<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
          </> : <label className="block text-sm">E-mail cadastrado<input type="email" autoComplete="email" required maxLength={256} value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Aguarde...' : reset ? 'Confirmar e salvar nova senha' : 'Enviar link de recuperação'}</button>
        </form>}
      {reset && !message && <Link to="/forgot-password" className="mt-5 block text-sm text-indigo-700 underline">Solicitar um novo link</Link>}
      <Link to="/login" className="mt-5 block text-sm text-slate-600 underline">Voltar ao login</Link>
    </section>
  </main>;
}
