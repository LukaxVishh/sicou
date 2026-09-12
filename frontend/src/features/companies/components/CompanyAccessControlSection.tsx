import {
  Edit,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ActionsDropdown } from '../../../shared/components';
import { getAccessesByCompany } from '../../access-control/api';
import type { UserAreaAccess } from '../../access-control/types';
import {
  CreateAccessModal,
  DeleteAccessModal,
  EditAccessModal,
} from '../../access-control/components';

type CompanyAccessControlSectionProps = {
  companyId: string;
};

export function CompanyAccessControlSection({
  companyId,
}: CompanyAccessControlSectionProps) {
  const [accesses, setAccesses] = useState<UserAreaAccess[]>([]);
  const [selectedAccess, setSelectedAccess] = useState<UserAreaAccess | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAccesses = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const data = await getAccessesByCompany(companyId);
      setAccesses(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível carregar os acessos.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadAccesses();
  }, [loadAccesses]);

  const filteredAccesses = accesses.filter((item) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const userName = (item.userName || '').toLowerCase();
      const userEmail = (item.userEmail || '').toLowerCase();
      const areaName = (item.areaName || '').toLowerCase();
      const unitName = (item.unitName || '').toLowerCase();
      return (
        userName.includes(term) ||
        userEmail.includes(term) ||
        areaName.includes(term) ||
        unitName.includes(term)
      );
    }
    return true;
  });

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Matriz de Permissões Granulares por Área
            </h2>
            <p className="text-sm text-slate-500">
              {accesses.length} regra(s) de privilégio operacional configurada(s)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadAccesses({ silent: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
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
            Conceder permissão
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {/* Busca */}
      <div className="mt-5 relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por colaborador, e-mail, área ou filial..."
          className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900"
        />
      </div>

      {/* Tabela de Acessos */}
      {isLoading ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Carregando matriz de acessos...
        </div>
      ) : filteredAccesses.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Nenhuma permissão configurada para esta empresa.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Conceda privilégios aos gestores e publicadores das áreas da sede.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Colaborador
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Área da Sede
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Escopo de Filial
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Permissões Ativas
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredAccesses.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.userName || 'Nome não associado'}
                    </p>
                    {item.userEmail && (
                      <p className="text-xs text-slate-500">{item.userEmail}</p>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800">
                      {item.areaName}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {item.unitName ? (
                      <span className="text-xs font-medium text-slate-700">{item.unitName}</span>
                    ) : (
                      <span className="text-xs text-slate-400">Geral (Sede / Toda a Empresa)</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {item.canView && (
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                          Visualizar
                        </span>
                      )}
                      {item.canManage && (
                        <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-purple-200">
                          Gerenciar
                        </span>
                      )}
                      {item.canPublishInformatives && (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          Informativos
                        </span>
                      )}
                      {item.canManageGuide && (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                          Orientador
                        </span>
                      )}
                      {item.canManageWorkflows && (
                        <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                          Workflows
                        </span>
                      )}
                      {item.canHandleWorkflowRequests && (
                        <span className="inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200">
                          Atendimento
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end">
                      <ActionsDropdown
                        items={[
                          {
                            label: 'Editar permissões',
                            onClick: () => {
                              setSelectedAccess(item);
                              setIsEditModalOpen(true);
                            },
                            icon: <Edit className="h-4 w-4" />,
                          },
                          {
                            label: 'Inativar regra',
                            onClick: () => {
                              setSelectedAccess(item);
                              setIsDeleteModalOpen(true);
                            },
                            icon: <Trash2 className="h-4 w-4" />,
                            variant: 'danger',
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateAccessModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => void loadAccesses({ silent: true })}
        defaultCompanyId={companyId}
      />

      <EditAccessModal
        access={selectedAccess}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedAccess(null);
        }}
        onUpdated={() => void loadAccesses({ silent: true })}
      />

      <DeleteAccessModal
        access={selectedAccess}
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedAccess(null);
        }}
        onDeleted={() => void loadAccesses({ silent: true })}
      />
    </div>
  );
}
