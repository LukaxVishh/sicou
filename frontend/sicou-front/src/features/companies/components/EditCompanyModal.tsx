import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { updateCompany } from '../api';
import type { Company } from '../types';

type EditCompanyModalProps = {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

export function EditCompanyModal({
  company,
  isOpen,
  onClose,
  onUpdated,
}: EditCompanyModalProps) {
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!company || !isOpen) {
      return;
    }

    setName(company.name);
    setDocument(company.document ?? '');
    setIsActive(company.isActive);
    setErrorMessage(null);
  }, [company, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!company) {
      return;
    }

    const companyToUpdate = company;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await updateCompany(companyToUpdate.id, {
        name: name.trim(),
        document: document.trim() || null,
        isActive,
      });

      await onUpdated();

      onClose();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível atualizar a empresa.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen || !company) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Editar empresa
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Atualize os dados cadastrais da empresa.
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
              htmlFor="edit-company-name"
              className="block text-sm font-medium text-slate-700"
            >
              Nome da empresa
            </label>

            <input
              id="edit-company-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              required
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="edit-company-document"
              className="block text-sm font-medium text-slate-700"
            >
              Documento
            </label>

            <input
              id="edit-company-document"
              type="text"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="CNPJ ou documento interno"
            />
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Empresa ativa
              </p>

              <p className="text-xs text-slate-500">
                Empresas inativas não aparecem nas listagens padrão.
              </p>
            </div>
          </label>

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
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}