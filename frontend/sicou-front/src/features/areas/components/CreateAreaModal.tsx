import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createArea } from '../api';
import type { AreaModuleCode } from '../types';

type CreateAreaModalProps = {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

const moduleOptions: Array<{
  code: AreaModuleCode;
  label: string;
  description: string;
}> = [
  {
    code: 'Informatives',
    label: 'Informativos',
    description: 'Permite publicar e gerenciar comunicados da área.',
  },
  {
    code: 'Guide',
    label: 'Orientador',
    description: 'Permite estruturar conteúdos de orientação da área.',
  },
  {
    code: 'Workflows',
    label: 'Workflows',
    description: 'Permite configurar e acompanhar fluxos da área.',
  },
];

export function CreateAreaModal({
  companyId,
  isOpen,
  onClose,
  onCreated,
}: CreateAreaModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [moduleCodes, setModuleCodes] = useState<AreaModuleCode[]>([
    'Informatives',
    'Guide',
    'Workflows',
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  function handleToggleModule(moduleCode: AreaModuleCode) {
    setModuleCodes((current) => {
      if (current.includes(moduleCode)) {
        return current.filter((code) => code !== moduleCode);
      }

      return [...current, moduleCode];
    });
  }

  function resetForm() {
    setName('');
    setDescription('');
    setModuleCodes(['Informatives', 'Guide', 'Workflows']);
    setErrorMessage(null);
  }

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (moduleCodes.length === 0) {
      setErrorMessage('Selecione pelo menos um módulo para a área.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await createArea(companyId, {
        name: name.trim(),
        description: description.trim() || null,
        moduleCodes,
      });

      await onCreated();

      resetForm();
      onClose();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível criar a área.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Nova área
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre uma área da sede e habilite seus módulos.
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
              htmlFor="area-name"
              className="block text-sm font-medium text-slate-700"
            >
              Nome da área
            </label>

            <input
              id="area-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="Ex: Jurídico"
              required
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="area-description"
              className="block text-sm font-medium text-slate-700"
            >
              Descrição
            </label>

            <textarea
              id="area-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-2 block w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="Descreva rapidamente a finalidade desta área."
            />
          </div>

          <div className="mt-5">
            <p className="block text-sm font-medium text-slate-700">
              Módulos habilitados
            </p>

            <div className="mt-3 grid gap-3">
              {moduleOptions.map((module) => {
                const isChecked = moduleCodes.includes(module.code);

                return (
                  <label
                    key={module.code}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleModule(module.code)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {module.label}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {module.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={handleClose}
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
              {isSubmitting ? 'Criando...' : 'Criar área'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}