import { MapPin, Plus, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getUnitsByCompanyId } from '../api';
import type { Unit } from '../types';
import { CreateUnitModal } from './CreateUnitModal';

type CompanyUnitsSectionProps = {
  companyId: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatLocation(unit: Unit) {
  if (unit.city && unit.state) {
    return `${unit.city}/${unit.state}`;
  }

  if (unit.city) {
    return unit.city;
  }

  if (unit.state) {
    return unit.state;
  }

  return 'Não informado';
}

export function CompanyUnitsSection({ companyId }: CompanyUnitsSectionProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadUnits(options?: { silent?: boolean }) {
    try {
      setErrorMessage(null);

      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getUnitsByCompanyId(companyId);

      setUnits(data);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível carregar as unidades.';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadUnits();
  }, [companyId]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2">
            <MapPin className="h-5 w-5 text-slate-700" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Unidades
            </h2>

            <p className="text-sm text-slate-500">
              {units.length} unidade(s) encontrada(s)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadUnits({ silent: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            Nova unidade
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Carregando unidades...
        </div>
      ) : units.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhuma unidade encontrada.
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Clique em “Nova unidade” para iniciar o cadastro.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unidade
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Código
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Localização
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Criada em
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {unit.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {unit.id}
                      </p>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {unit.code || 'Não informado'}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {formatLocation(unit)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    {unit.isActive ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                        Inativa
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {formatDate(unit.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUnitModal
        companyId={companyId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => loadUnits({ silent: true })}
      />
    </div>
  );
}