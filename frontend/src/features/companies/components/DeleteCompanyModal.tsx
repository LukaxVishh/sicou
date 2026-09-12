import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { deleteCompany } from '../api';
import type { Company } from '../types';

type DeleteCompanyModalProps = {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
};

export function DeleteCompanyModal({
  company,
  isOpen,
  onClose,
  onDeleted,
}: DeleteCompanyModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    if (!company) {
      return;
    }

    const companyToDelete = company;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await deleteCompany(companyToDelete.id);

      await onDeleted();

      onClose();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível inativar a empresa.';

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
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 ring-1 ring-amber-200">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Inativar empresa
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Esta ação poderá ocultar a empresa das listagens padrão.
              </p>
            </div>
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

        <div className="px-6 py-5">
          {errorMessage && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <p className="text-sm text-slate-700">
            Tem certeza que deseja inativar a empresa{' '}
            <span className="font-semibold text-slate-900">
              {company.name}
            </span>
            ?
          </p>

          <p className="mt-3 text-sm text-slate-500">
            No backend, esta operação é um soft delete: o registro será marcado como inativo.
          </p>

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
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Inativando...' : 'Inativar empresa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}