import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createUnit } from '../api';

type CreateUnitModalProps = {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

export function CreateUnitModal({
  companyId,
  isOpen,
  onClose,
  onCreated,
}: CreateUnitModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await createUnit(companyId, {
        name: name.trim(),
        code: code.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
      });

      setName('');
      setCode('');
      setCity('');
      setState('');

      await onCreated();

      onClose();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível criar a unidade.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Nova unidade
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre uma unidade vinculada a esta empresa.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-5"
        >
          {errorMessage && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="unit-name"
              className="block text-sm font-medium text-slate-700"
            >
              Nome da unidade
            </label>

            <input
              id="unit-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="Ex: Unidade Centro"
              required
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="unit-code"
              className="block text-sm font-medium text-slate-700"
            >
              Código
            </label>

            <input
              id="unit-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="Ex: UN001"
            />

            <p className="mt-1 text-xs text-slate-500">
              Campo opcional.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="unit-city"
                className="block text-sm font-medium text-slate-700"
              >
                Cidade
              </label>

              <input
                id="unit-city"
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="Ex: São Paulo"
              />
            </div>

            <div>
              <label
                htmlFor="unit-state"
                className="block text-sm font-medium text-slate-700"
              >
                Estado
              </label>

              <input
                id="unit-state"
                type="text"
                value={state}
                onChange={(event) => setState(event.target.value.toUpperCase())}
                maxLength={2}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                placeholder="SP"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar unidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}