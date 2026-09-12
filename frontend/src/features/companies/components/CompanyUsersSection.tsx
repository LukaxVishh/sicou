import {
  Briefcase,
  Building2,
  Mail,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getUsers } from '../../users/api';
import type { User, UserRole } from '../../users/types';
import { CreateUserModal, EditUserModal } from '../../users/components';
import { ActionsDropdown } from '../../../shared/components';

type CompanyUsersSectionProps = {
  companyId: string;
};

const roleBadges: Record<UserRole, { label: string; bg: string; text: string; border: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  COMPANY_ADMIN: {
    label: 'Admin Empresa',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  AREA_ADMIN: {
    label: 'Admin Área',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  HEADQUARTER_USER: {
    label: 'Usuário Sede',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  UNIT_USER: {
    label: 'Usuário Unidade',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
};

export function CompanyUsersSection({ companyId }: CompanyUsersSectionProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const allUsers = await getUsers();
      const companyUsers = allUsers.filter((u) => u.companyId === companyId);
      setUsers(companyUsers);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível carregar os colaboradores.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter((u) => {
    if (roleFilter && !u.roles.includes(roleFilter as UserRole)) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const name = u.fullName.toLowerCase();
      const email = u.email.toLowerCase();
      const unit = (u.unitName || '').toLowerCase();
      return name.includes(term) || email.includes(term) || unit.includes(term);
    }
    return true;
  });

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Colaboradores da Empresa
            </h2>
            <p className="text-sm text-slate-500">
              {users.length} colaborador(es) vinculado(s) a esta empresa
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadUsers({ silent: true })}
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
            Novo colaborador
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {/* Filtros */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail ou filial..."
            className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Todos os papéis e funções</option>
            <option value="COMPANY_ADMIN">Administrador da Empresa</option>
            <option value="HEADQUARTER_USER">Usuário da Sede</option>
            <option value="AREA_ADMIN">Administrador de Área</option>
            <option value="UNIT_USER">Usuário de Unidade / Filial</option>
          </select>
        </div>
      </div>

      {/* Tabela de Usuários */}
      {isLoading ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Carregando colaboradores...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Nenhum colaborador encontrado.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre os administradores, gestores de sede e atendentes de filial desta empresa.
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
                  Função / Papel
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Alocação
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {user.fullName}
                    </p>
                    <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.map((role) => {
                        const badge = roleBadges[role] || {
                          label: role,
                          bg: 'bg-slate-100',
                          text: 'text-slate-700',
                          border: 'border-slate-200',
                        };
                        return (
                          <span
                            key={role}
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {user.unitName ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                        <MapPin className="h-3.5 w-3.5" />
                        {user.unitName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                        <Building2 className="h-3.5 w-3.5" />
                        Sede Central
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <UserCheck className="h-3.5 w-3.5" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                        <UserX className="h-3.5 w-3.5" /> Inativo
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end">
                      <ActionsDropdown
                        items={[
                          {
                            label: 'Editar dados',
                            onClick: () => {
                              setSelectedUser(user);
                              setIsEditModalOpen(true);
                            },
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

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => void loadUsers({ silent: true })}
      />

      <EditUserModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        onUpdated={() => void loadUsers({ silent: true })}
      />
    </div>
  );
}
