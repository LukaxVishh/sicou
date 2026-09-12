import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { deleteAccess } from '../api';
import type { UserAreaAccess } from '../types';

type DeleteAccessModalProps = {
  access: UserAreaAccess | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
};

export function DeleteAccessModal({
  access,
  isOpen,
  onClose,
  onDeleted,
}: DeleteAccessModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !access) {
    return null;
  }

  function handleClose() {
    if (isDeleting) return;
    setErrorMessage(null);
    onClose();
  }

  async function handleDelete() {
    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await deleteAccess(access!.id);
      await onDeleted();
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível inativar este acesso.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-100 p-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Inativar acesso
              </h2>
              <p className="text-xs text-slate-500">
                Revogação de permissões por área
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <p className="text-sm text-slate-700">
            Tem certeza de que deseja revogar o acesso de{' '}
            <strong className="text-slate-900">
              {access.userName || access.userEmail || 'usuário'}
            </strong>{' '}
            à área <strong className="text-slate-900">{access.areaName}</strong>?
          </p>

          <p className="mt-2 text-xs text-slate-500">
            O vínculo será marcado como inativo e o usuário perderá imediatamente todas as permissões concedidas nesta área.
          </p>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {isDeleting ? 'Inativando...' : 'Inativar acesso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
