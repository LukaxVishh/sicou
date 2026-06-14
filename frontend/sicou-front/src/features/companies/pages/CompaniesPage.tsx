import { Building2, Edit, Eye, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
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

  async function loadCompanies(options?: { silent?: boolean }) {
    try {
      setErrorMessage(null);

      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getCompanies();

      setCompanies(data);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível carregar as empresas.';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

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

  useEffect(() => {
    loadCompanies();
  }, []);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">Administração</p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Empresas
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Gerencie as empresas cadastradas na plataforma Sicou.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadCompanies({ silent: true })}
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
            Nova empresa
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
          <div className="rounded-xl bg-slate-100 p-2">
            <Building2 className="h-5 w-5 text-slate-700" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Empresas cadastradas
            </h2>

            <p className="text-sm text-slate-500">
              {companies.length} empresa(s) encontrada(s)
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Carregando empresas...
          </div>
        ) : companies.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Nenhuma empresa encontrada.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Clique em “Nova empresa” para iniciar o cadastro.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nome
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Documento
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Criada em
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {company.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {company.id}
                        </p>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {company.document || 'Não informado'}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      {company.isActive ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          Ativa
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                          Inativa
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {formatDate(company.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <Link
                          to={`/app/companies/${company.id}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950"
                        >
                          <Eye className="h-4 w-4" />
                          Abrir
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(company)}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950"
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(company)}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                          Inativar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateCompanyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => loadCompanies({ silent: true })}
      />

      <EditCompanyModal
        company={selectedCompany}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onUpdated={() => loadCompanies({ silent: true })}
      />

      <DeleteCompanyModal
        company={selectedCompany}
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onDeleted={() => loadCompanies({ silent: true })}
      />
    </div>
  );
}