import {
  Building2,
  Edit,
  KeyRound,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ActionsDropdown } from '../../../shared/components';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { getCompanies } from '../../companies/api';
import type { Company } from '../../companies/types';
import { getUsers } from '../api';
import type { User, UserRole } from '../types';
import {
  CreateUserModal,
  DeleteUserModal,
} from '../components';
import { getAccessesByCompany } from '../../access-control/api';
import type { UserAreaAccess } from '../../access-control/types';

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Admin da empresa',
  AREA_ADMIN: 'Admin da área',
  HEADQUARTER_USER: 'Usuário da sede',
  UNIT_USER: 'Usuário da unidade',
};

function formatDate(value?: string | null) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRoleLabel(role: string) {
  return roleLabels[role as UserRole] ?? role;
}

export function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.roles.includes(SystemRoles.SuperAdmin) ?? false;

  // Empresas e Empresa Selecionada
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    currentUser?.companyId || '',
  );

  // Estado de Usuários
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Estado de Vínculos de Acesso às Áreas da Empresa
  const [accesses, setAccesses] = useState<UserAreaAccess[]>([]);

  // Modais de Criação e Inativação de Usuário
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);

  // Loading e Erros
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Carregar Empresas se SuperAdmin
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
    } else if (currentUser?.companyId) {
      setSelectedCompanyId(currentUser.companyId);
    }
  }, [isSuperAdmin, currentUser?.companyId]);

  // 2. Carregar Usuários e Acessos
  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const targetCompanyId = isSuperAdmin ? selectedCompanyId : currentUser?.companyId;

      const [usersData, accessesData] = await Promise.all([
        getUsers(),
        targetCompanyId ? getAccessesByCompany(targetCompanyId).catch(() => [] as UserAreaAccess[]) : Promise.resolve([] as UserAreaAccess[]),
      ]);

      const filtered = targetCompanyId
        ? usersData.filter((u) => u.companyId === targetCompanyId || (!u.companyId && isSuperAdmin))
        : usersData;

      setUsers(filtered);
      setAccesses(accessesData.filter((a) => a.isActive));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os colaboradores.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isSuperAdmin, selectedCompanyId, currentUser?.companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleOpenDeleteUser(u: User) {
    setSelectedUser(u);
    setIsDeleteUserModalOpen(true);
  }

  // Mapear áreas por usuário
  const userAreasMap = useMemo(() => {
    const map = new Map<string, string[]>();
    accesses.forEach((a) => {
      const existing = map.get(a.userId) || [];
      if (!existing.includes(a.areaName)) {
        existing.push(a.areaName);
      }
      map.set(a.userId, existing);
    });
    return map;
  }, [accesses]);

  // Filtragem de Usuários
  const filteredUsers = users.filter((u) => {
    if (userRoleFilter && !u.roles.includes(userRoleFilter as UserRole)) {
      return false;
    }

    if (userStatusFilter === 'active' && !u.isActive) return false;
    if (userStatusFilter === 'inactive' && u.isActive) return false;

    if (userSearch) {
      const term = userSearch.toLowerCase();
      const matchName = u.fullName.toLowerCase().includes(term);
      const matchEmail = u.email.toLowerCase().includes(term);
      const matchUnit = (u.unitName || '').toLowerCase().includes(term);
      return matchName || matchEmail || matchUnit;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Governança & Gestão de Pessoas</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Usuários & Colaboradores
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Gerencie colaboradores, alocações de áreas e permissões detalhadas centralizadas no perfil de cada usuário.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && companies.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Empresa:</span>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadData({ silent: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition disabled:opacity-70"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => setIsCreateUserModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition"
          >
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 shadow-sm">
          {errorMessage}
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou filial..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            value={userRoleFilter}
            onChange={(e) => setUserRoleFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="">Todos os papéis e funções</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COMPANY_ADMIN">Admin da Empresa</option>
            <option value="AREA_ADMIN">Admin da Área</option>
            <option value="HEADQUARTER_USER">Usuário da Sede</option>
            <option value="UNIT_USER">Usuário da Unidade</option>
          </select>
        </div>

        <div>
          <select
            value={userStatusFilter}
            onChange={(e) => setUserStatusFilter(e.target.value as any)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="all">Todos os status</option>
            <option value="active">Apenas Ativos</option>
            <option value="inactive">Apenas Inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-xs text-slate-500">
            Carregando colaboradores...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Nenhum colaborador encontrado.</p>
            <p className="text-xs text-slate-500">Clique em “Novo usuário” para cadastrar um colaborador.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Colaborador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Lotação / Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Funções Globais
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Áreas Alocadas & Permissões
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Criado em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.map((u) => {
                  const userAreaNames = userAreasMap.get(u.id) || [];

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      {/* Colaborador */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/app/users/${u.id}`)}
                          className="text-left group transition focus:outline-none"
                        >
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                            {u.fullName}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </button>
                      </td>

                      {/* Lotação */}
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-700">
                        {u.unitName ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {u.unitName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                            Sede Corporativa
                          </span>
                        )}
                      </td>

                      {/* Funções Globais */}
                      <td className="px-6 py-4">
                        {u.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {u.roles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
                              >
                                {getRoleLabel(role)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Sem função atribuída</span>
                        )}
                      </td>

                      {/* Áreas Alocadas & Permissões */}
                      <td className="px-6 py-4">
                        {userAreaNames.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/app/users/${u.id}`)}
                            className="flex flex-wrap items-center gap-1.5 group text-left"
                            title="Clique para editar áreas e permissões deste usuário"
                          >
                            {userAreaNames.map((areaName) => (
                              <span
                                key={areaName}
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200 group-hover:bg-indigo-100 transition"
                              >
                                <KeyRound className="w-2.5 h-2.5 text-indigo-500" />
                                {areaName}
                              </span>
                            ))}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/app/users/${u.id}`)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition"
                          >
                            <Plus className="w-3 h-3" /> Alocar área
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-6 py-4">
                        {u.isActive ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Criado em */}
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-500">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Ações */}
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex justify-end">
                          <ActionsDropdown
                            items={[
                              {
                                label: 'Editar Usuário',
                                onClick: () => navigate(`/app/users/${u.id}`),
                                icon: <Edit className="h-4 w-4" />,
                              },
                              {
                                label: 'Inativar Usuário',
                                onClick: () => handleOpenDeleteUser(u),
                                icon: <Trash2 className="h-4 w-4" />,
                                variant: 'danger',
                                disabled: !u.isActive,
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais de Usuário */}
      <CreateUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        onCreated={() => void loadData({ silent: true })}
      />

      <DeleteUserModal
        user={selectedUser}
        isOpen={isDeleteUserModalOpen}
        onClose={() => {
          setIsDeleteUserModalOpen(false);
          setSelectedUser(null);
        }}
        onDeleted={() => void loadData({ silent: true })}
      />
    </div>
  );
}