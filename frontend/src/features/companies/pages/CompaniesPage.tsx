import { BadgeCheck, Ban, Building2, Edit, Eye, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ActionsDropdown, SystemEmptyState, SystemLoadingState, SystemNotice } from '../../../shared/components';
import {
  CreateCompanyModal,
  DeleteCompanyModal,
  EditCompanyModal,
} from '../components';
import { getCompanies } from '../api';
import type { Company } from '../types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCompanies = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (options?.silent) {
        setErrorMessage(null);
        setIsRefreshing(true);
      }

      const data = await getCompanies();

      setCompanies(data);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível carregar as empresas.';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  function handleOpenEditModal(company: Company) {
    setSelectedCompany(company);
    setIsEditModalOpen(true);
  }

  function handleOpenDeleteModal(company: Company) {
    setSelectedCompany(company);
    setIsDeleteModalOpen(true);
  }

  function handleCloseEditModal() {
    setIsEditModalOpen(false);
    setSelectedCompany(null);
  }

  function handleCloseDeleteModal() {
    setIsDeleteModalOpen(false);
    setSelectedCompany(null);
  }

  const activeCompanies = companies.filter((company) => company.isActive).length;
  const inactiveCompanies = companies.length - activeCompanies;

  useEffect(() => {
    let isMounted = true;

    getCompanies()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setCompanies(data);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error
          ? error.message
          : 'Não foi possível carregar as empresas.';

        setErrorMessage(message);
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setIsLoading(false);
        setIsRefreshing(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-6">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 xl:flex-row xl:items-end">
        <div className="flex items-start gap-4">
          <div className="hidden h-14 w-1 shrink-0 rounded-full bg-indigo-500 sm:block" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">Administração · Cadastros</p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">Empresas</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-5 text-slate-500">
              Consulte e mantenha os cadastros das organizações da plataforma.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:pb-0.5">
          <button
            type="button"
            onClick={() => void loadCompanies({ silent: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-600/15 transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Nova empresa
          </button>
        </div>
      </header>

      <section aria-label="Resumo das empresas" className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3">
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:border-r sm:border-slate-200 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total cadastradas</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{isLoading ? '—' : companies.length}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Building2 className="h-5 w-5" />
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 sm:border-r sm:border-t-0 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativas</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{isLoading ? '—' : activeCompanies}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <BadgeCheck className="h-5 w-5" />
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 sm:border-t-0 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inativas</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{isLoading ? '—' : inactiveCompanies}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <Ban className="h-5 w-5" />
          </span>
        </div>
      </section>

      {errorMessage && (
        <SystemNotice className="mt-6">{errorMessage}</SystemNotice>
      )}

      <section aria-labelledby="company-directory-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 id="company-directory-title" className="text-base font-semibold tracking-tight text-slate-900">Diretório de empresas</h2>
            <p className="mt-0.5 text-xs text-slate-500">Dados cadastrais, situação e data de inclusão.</p>
          </div>
          <span className="text-xs font-medium text-slate-400">{companies.length} {companies.length === 1 ? 'registro' : 'registros'}</span>
        </div>

        {isLoading ? (
          <SystemLoadingState label="Carregando empresas..." />
        ) : companies.length === 0 ? (
          <SystemEmptyState
            icon={Building2}
            title="Nenhuma empresa cadastrada"
            description="Adicione uma empresa para começar a organizar a plataforma."
            action={<button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <Plus className="h-4 w-4" /> Nova empresa
            </button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed divide-y divide-slate-100">
              <caption className="sr-only">Empresas cadastradas na plataforma</caption>
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[21%]" />
                <col className="w-[15%]" />
                <col className="w-[24%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Nome
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Documento
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Criada em
                  </th>

                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {companies.map((company) => (
                  <tr key={company.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <p className="truncate text-sm font-semibold text-slate-900">{company.name}</p>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-slate-600">
                      {company.document || <span className="font-sans text-slate-400">Não informado</span>}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {company.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Inativa
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {formatDate(company.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end">
                        <ActionsDropdown
                          items={[
                            {
                              label: 'Abrir',
                              to: `/app/companies/${company.id}`,
                              icon: <Eye className="h-4 w-4" />,
                            },
                            {
                              label: 'Editar',
                              onClick: () => handleOpenEditModal(company),
                              icon: <Edit className="h-4 w-4" />,
                            },
                            {
                              label: 'Inativar',
                              onClick: () => handleOpenDeleteModal(company),
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
      </section>

      <CreateCompanyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => void loadCompanies({ silent: true })}
      />

      <EditCompanyModal
        company={selectedCompany}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onUpdated={() => void loadCompanies({ silent: true })}
      />

      <DeleteCompanyModal
        company={selectedCompany}
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onDeleted={() => void loadCompanies({ silent: true })}
      />
    </div>
  );
}
