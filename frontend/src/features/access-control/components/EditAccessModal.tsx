import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { updateAccess } from '../api';
import type { UserAreaAccess } from '../types';

type EditAccessModalProps = {
  access: UserAreaAccess | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

export function EditAccessModal({
  access,
  isOpen,
  onClose,
  onUpdated,
}: EditAccessModalProps) {
  const [canView, setCanView] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [canPublishInformatives, setCanPublishInformatives] = useState(false);
  const [canManageGuide, setCanManageGuide] = useState(false);
  const [canManageWorkflows, setCanManageWorkflows] = useState(false);
  const [canHandleWorkflowRequests, setCanHandleWorkflowRequests] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (access) {
      setCanView(access.canView);
      setCanManage(access.canManage);
      setCanPublishInformatives(access.canPublishInformatives);
      setCanManageGuide(access.canManageGuide);
      setCanManageWorkflows(access.canManageWorkflows);
      setCanHandleWorkflowRequests(access.canHandleWorkflowRequests);
      setErrorMessage(null);
    }
  }, [access]);

  if (!isOpen || !access) {
    return null;
  }

  function handleClose() {
    if (isSubmitting) return;
    setErrorMessage(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await updateAccess(access!.id, {
        canView,
        canManage,
        canPublishInformatives,
        canManageGuide,
        canManageWorkflows,
        canHandleWorkflowRequests,
      });

      await onUpdated();
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível atualizar as permissões.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Editar permissões de acesso
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Atualize as permissões de {access.userName || access.userEmail || 'usuário'} na área {access.areaName}.
            </p>
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

        <form onSubmit={handleSubmit} className="p-6">
          {errorMessage && (
            <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="mb-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">Colaborador</p>
                <p className="font-bold text-slate-900">{access.userName || 'Nome não carregado'}</p>
                {access.userEmail && <p className="text-xs text-slate-600">{access.userEmail}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Área da Sede</p>
                <p className="font-bold text-slate-900">{access.areaName}</p>
                <p className="text-xs text-slate-600">{access.companyName} {access.unitName ? `· ${access.unitName}` : ''}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Permissões
            </h3>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={canView}
                onChange={(e) => setCanView(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Visualizar Área</p>
                <p className="text-xs text-slate-500">Acesso para consultar dados e itens da área.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={canManage}
                onChange={(e) => setCanManage(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Gerenciar Área</p>
                <p className="text-xs text-slate-500">Acesso para alterar configurações e módulos.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={canPublishInformatives}
                onChange={(e) => setCanPublishInformatives(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Publicar Informativos</p>
                <p className="text-xs text-slate-500">Criar e publicar comunicados setoriais.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={canManageGuide}
                onChange={(e) => setCanManageGuide(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Gerenciar Orientador</p>
                <p className="text-xs text-slate-500">Cadastrar manuais, links e tutoriais.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={canManageWorkflows}
                onChange={(e) => setCanManageWorkflows(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Gerenciar Workflows</p>
                <p className="text-xs text-slate-500">Criar e configurar fluxos e etapas.</p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={canHandleWorkflowRequests}
                onChange={(e) => setCanHandleWorkflowRequests(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Tratar Solicitações</p>
                <p className="text-xs text-slate-500">Analisar, aprovar ou rejeitar chamados da área.</p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
