import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createCompany } from '../api';

type CreateCompanyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

export function CreateCompanyModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCompanyModalProps) {
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
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
      await createCompany({
        name: name.trim(),
        document: document.trim() || null,
      });

      setName('');
      setDocument('');

      await onCreated();

      onClose();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível criar a empresa.';

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
              Nova empresa
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre uma nova empresa na plataforma.
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
              htmlFor="company-name"
              className="block text-sm font-medium text-slate-700"
            >
              Nome da empresa
            </label>

            <input
              id="company-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="Ex: Empresa Sicou"
              required
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="company-document"
              className="block text-sm font-medium text-slate-700"
            >
              Documento
            </label>

            <input
              id="company-document"
              type="text"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="CNPJ ou documento interno"
            />

            <p className="mt-1 text-xs text-slate-500">
              Campo opcional.
            </p>
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
              {isSubmitting ? 'Salvando...' : 'Salvar empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}