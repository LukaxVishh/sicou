import { NativeSelectDropdown } from '../../../shared/components/NativeSelectDropdown';
import {
  Edit,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { ActionsDropdown } from '../../../shared/components';
import { SystemEmptyState, SystemLoadingState, SystemNotice } from '../../../shared/components';
import { getCompanies } from '../../companies/api';
import { getAreasByCompanyId } from '../../areas/api';
import type { Company } from '../../companies/types';
import type { CompanyArea } from '../../areas/types';
import { getAccessesByCompany } from '../api';
import type { UserAreaAccess } from '../types';
import {
  CreateAccessModal,
  DeleteAccessModal,
  EditAccessModal,
} from '../components';

function formatDate(value?: string | null) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AccessControlPage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.roles.includes(SystemRoles.SuperAdmin) ?? false;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    currentUser?.companyId || '',
  );

  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const [accesses, setAccesses] = useState<UserAreaAccess[]>([]);
  const [selectedAccess, setSelectedAccess] = useState<UserAreaAccess | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Carrega empresas se superadmin
  useEffect(() => {
    if (isSuperAdmin) {
      getCompanies()
        .then((data) => {
          setCompanies(data);
          if (!selectedCompanyId && data.length > 0) {
            setSelectedCompanyId(data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  // Carrega áreas da empresa
  useEffect(() => {
    if (!selectedCompanyId) {
      setAreas([]);
      return;
    }

    getAreasByCompanyId(selectedCompanyId)
      .then((data: CompanyArea[]) => setAreas(data.filter((a: CompanyArea) => a.isActive)))
      .catch(() => setAreas([]));
  }, [selectedCompanyId]);

  // Carrega os acessos da empresa
  const loadAccesses = useCallback(async (options?: { silent?: boolean }) => {
    if (!selectedCompanyId) {
      setAccesses([]);
      setIsLoading(false);
      return;
    }

    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const data = await getAccessesByCompany(selectedCompanyId);
      setAccesses(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível carregar as permissões.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadAccesses();
  }, [loadAccesses]);

  function handleOpenEditModal(access: UserAreaAccess) {
    setSelectedAccess(access);
    setIsEditModalOpen(true);
  }

  function handleOpenDeleteModal(access: UserAreaAccess) {
    setSelectedAccess(access);
    setIsDeleteModalOpen(true);
  }

  function handleCloseEditModal() {
    setIsEditModalOpen(false);
    setSelectedAccess(null);
  }

  function handleCloseDeleteModal() {
    setIsDeleteModalOpen(false);
    setSelectedAccess(null);
  }

  // Filtragem local
  const filteredAccesses = accesses.filter((item) => {
    if (selectedAreaFilter && item.areaId !== selectedAreaFilter) {
      return false;
    }

    if (searchUser) {
      const term = searchUser.toLowerCase();
      const userName = (item.userName || '').toLowerCase();
      const userEmail = (item.userEmail || '').toLowerCase();
      const unitName = (item.unitName || '').toLowerCase();
      return (
        userName.includes(term) ||
        userEmail.includes(term) ||
        unitName.includes(term)
      );
    }

    return true;
  });

  return (
    <section className="mx-auto w-full max-w-[1680px] space-y-6">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 xl:flex-row xl:items-end">
        <div className="flex items-start gap-4">
          <span className="hidden h-14 w-1 shrink-0 rounded-full bg-indigo-500 sm:block" />
          <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">Governança e segurança</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">
            Controle de Permissões Granulares
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-500">
            Gerencie os privilégios e acessos por área da sede e unidade de atendimento.
          </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:pb-0.5">
          <button
            type="button"
            onClick={() => void loadAccesses({ silent: true })}
            disabled={isRefreshing || isLoading || !selectedCompanyId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!selectedCompanyId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            Novo acesso
          </button>
        </div>
      </header>

      {errorMessage && (
        <SystemNotice>{errorMessage}</SystemNotice>
      )}

      {/* Barra de Filtros */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        {isSuperAdmin && (
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Empresa
            </label>
            <NativeSelectDropdown
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Selecione uma empresa</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelectDropdown>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Área da Sede
          </label>
          <NativeSelectDropdown
            value={selectedAreaFilter}
            onChange={(e) => setSelectedAreaFilter(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelectDropdown>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Buscar Colaborador
          </label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Nome, e-mail ou filial..."
              className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Permissões */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Acessos e Privilégios Ativos
            </h2>
            <p className="text-sm text-slate-500">
              {filteredAccesses.length} registro(s) encontrado(s)
            </p>
          </div>
        </div>

        {isLoading ? (
          <SystemLoadingState label="Carregando permissões..." />
        ) : filteredAccesses.length === 0 ? (
          <SystemEmptyState title="Nenhuma permissão encontrada" description="Clique em “Novo acesso” para conceder permissões a um usuário." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Colaborador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Área
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Permissões Habilitadas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Concedido em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredAccesses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.userName || 'Nome não associado'}
                      </p>
                      {item.userEmail && (
                        <p className="text-xs text-slate-500">{item.userEmail}</p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800">
                        {item.areaName}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {item.unitName || (
                        <span className="text-xs text-slate-400">Geral (Sede)</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
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

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {formatDate(item.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <ActionsDropdown
                          items={[
                            {
                              label: 'Editar permissões',
                              onClick: () => handleOpenEditModal(item),
                              icon: <Edit className="h-4 w-4" />,
                            },
                            {
                              label: 'Inativar acesso',
                              onClick: () => handleOpenDeleteModal(item),
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
      </div>

      <CreateAccessModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => void loadAccesses({ silent: true })}
        defaultCompanyId={selectedCompanyId}
      />

      <EditAccessModal
        access={selectedAccess}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onUpdated={() => void loadAccesses({ silent: true })}
      />

      <DeleteAccessModal
        access={selectedAccess}
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onDeleted={() => void loadAccesses({ silent: true })}
      />
    </section>
  );
}
