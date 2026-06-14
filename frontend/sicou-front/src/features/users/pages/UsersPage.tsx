import { Edit, RefreshCcw, Trash2, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ActionsDropdown } from '../../../shared/components';
import {
  CreateUserModal,
  DeleteUserModal,
  EditUserModal,
} from '../components';
import { getUsers } from '../api';
import type { User, UserRole } from '../types';

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Admin da empresa',
  AREA_ADMIN: 'Admin da área',
  HEADQUARTER_USER: 'Usuário da sede',
  UNIT_USER: 'Usuário da unidade',
};

function formatDate(value?: string | null) {
  if (!value) {
    return 'Não informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRoleLabel(role: string) {
  return roleLabels[role as UserRole] ?? role;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (options?.silent) {
        setErrorMessage(null);
        setIsRefreshing(true);
      }

      const data = await getUsers();

      setUsers(data);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível carregar os usuários.';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  function handleOpenEditModal(user: User) {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  }

  function handleCloseEditModal() {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  }

  function handleOpenDeleteModal(user: User) {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  }

  function handleCloseDeleteModal() {
    setIsDeleteModalOpen(false);
    setSelectedUser(null);
  }

  useEffect(() => {
    let isMounted = true;

    getUsers()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setUsers(data);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error
          ? error.message
          : 'Não foi possível carregar os usuários.';

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
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">Administração</p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Usuários
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Gerencie os usuários cadastrados e suas funções no Sicou.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadUsers({ silent: true })}
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
            <UserPlus className="h-4 w-4" />
            Novo usuário
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
            <Users className="h-5 w-5 text-slate-700" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Usuários cadastrados
            </h2>

            <p className="text-sm text-slate-500">
              {users.length} usuário(s) encontrado(s)
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Carregando usuários...
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Nenhum usuário encontrado.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Clique em “Novo usuário” para iniciar o cadastro.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Usuário
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Empresa
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Unidade
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Funções
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Criado em
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {user.fullName}
                        </p>

                        <p className="text-xs text-slate-500">
                          {user.email}
                        </p>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {user.companyId || 'Não vinculada'}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {user.unitId || 'Não vinculada'}
                    </td>

                    <td className="px-6 py-4">
                      {user.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                            >
                              {getRoleLabel(role)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">
                          Sem função
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      {user.isActive ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                          Inativo
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                      {formatDate(user.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex justify-end">
                        <ActionsDropdown
                          items={[
                            {
                              label: 'Editar',
                              onClick: () => handleOpenEditModal(user),
                              icon: <Edit className="h-4 w-4" />,
                            },
                            {
                              label: 'Inativar',
                              onClick: () => handleOpenDeleteModal(user),
                              icon: <Trash2 className="h-4 w-4" />,
                              variant: 'danger',
                              disabled: !user.isActive,
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

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => void loadUsers({ silent: true })}
      />

      <EditUserModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onUpdated={() => void loadUsers({ silent: true })}
      />

      <DeleteUserModal
        user={selectedUser}
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onDeleted={() => void loadUsers({ silent: true })}
      />
    </div>
  );
}