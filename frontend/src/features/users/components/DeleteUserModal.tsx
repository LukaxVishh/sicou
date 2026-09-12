import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { deleteUser } from '../api';
import type { User } from '../types';

type DeleteUserModalProps = {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
};

export function DeleteUserModal({
  user,
  isOpen,
  onClose,
  onDeleted,
}: DeleteUserModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !user) {
    return null;
  }

  async function handleDelete() {
    if (!user) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await deleteUser(user.id);

      await onDeleted();

      onClose();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível inativar o usuário.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-50 p-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Inativar usuário
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Confirme a inativação deste usuário.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
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

          <p className="text-sm text-slate-600">
            Você está prestes a inativar o usuário:
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {user.fullName}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {user.email}
            </p>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            O usuário continuará registrado no sistema, mas ficará marcado como
            inativo pelo backend.
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
              onClick={() => void handleDelete()}
              disabled={isSubmitting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Inativando...' : 'Inativar usuário'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}