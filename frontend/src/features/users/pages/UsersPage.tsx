import { NativeSelectDropdown } from '../../../shared/components/NativeSelectDropdown';
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
import { SystemEmptyState, SystemLoadingState, SystemNotice } from '../../../shared/components';
import { apiFetch } from '../../../shared/api';
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
  const canResetPasswords = isSuperAdmin || (currentUser?.roles.includes(SystemRoles.CompanyAdmin) ?? false);
  const [recoverableUserIds, setRecoverableUserIds] = useState<string[]>([]);

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

      const [usersData, accessesData, recoveryUsers] = await Promise.all([
        getUsers(),
        targetCompanyId ? getAccessesByCompany(targetCompanyId).catch(() => [] as UserAreaAccess[]) : Promise.resolve([] as UserAreaAccess[]),
        canResetPasswords ? apiFetch<{ id: string }[]>('/api/password-recovery/users') : Promise.resolve([]),
      ]);

      const filtered = targetCompanyId
        ? usersData.filter((u) => u.companyId === targetCompanyId || (!u.companyId && isSuperAdmin))
        : usersData;

      setUsers(filtered);
      setRecoverableUserIds(recoveryUsers.map((candidate) => candidate.id));
      setAccesses(accessesData.filter((a) => a.isActive));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os colaboradores.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isSuperAdmin, selectedCompanyId, currentUser?.companyId, canResetPasswords]);

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
    <div className="mx-auto w-full max-w-[1680px] space-y-6">
      <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 xl:flex-row xl:items-end">
        <div className="flex items-start gap-4">
          <div className="hidden h-14 w-1 shrink-0 rounded-full bg-indigo-500 sm:block" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">Administração · Gestão de pessoas</p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950">Usuários &amp; Colaboradores</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-5 text-slate-500">
              Gerencie colaboradores, lotações e permissões de acesso.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:pb-0.5">
          {isSuperAdmin && companies.length > 0 && (
            <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <span className="text-xs font-medium text-slate-500">Empresa</span>
              <NativeSelectDropdown
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-36"
                aria-label="Empresa"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelectDropdown>
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadData({ silent: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => setIsCreateUserModalOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </button>
        </div>
      </header>

      {errorMessage && (
        <SystemNotice className="text-xs font-semibold shadow-sm">{errorMessage}</SystemNotice>
      )}

      <section aria-label="Filtros de colaboradores" className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">Encontrar colaboradores</p>
          <span className="text-xs text-slate-500">{isLoading ? 'Carregando lista...' : `${filteredUsers.length} resultados`}</span>
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-12">
        <label className="min-w-0 lg:col-span-6">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Busca</span>
          <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Nome, e-mail ou unidade"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
          />
          </span>
        </label>

        <div className="min-w-0 lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Função</span>
          <NativeSelectDropdown
            value={userRoleFilter}
            onChange={(e) => setUserRoleFilter(e.target.value)}
            className="w-full h-11"
            aria-label="Filtrar por função"
          >
            <option value="">Todos os papéis e funções</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COMPANY_ADMIN">Admin da Empresa</option>
            <option value="AREA_ADMIN">Admin da Área</option>
            <option value="HEADQUARTER_USER">Usuário da Sede</option>
            <option value="UNIT_USER">Usuário da Unidade</option>
          </NativeSelectDropdown>
        </div>

        <div className="min-w-0 lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Situação</span>
          <NativeSelectDropdown
            value={userStatusFilter}
            onChange={(e) => setUserStatusFilter(e.target.value as any)}
            className="w-full h-11"
            aria-label="Filtrar por situação"
          >
            <option value="all">Todos os status</option>
            <option value="active">Apenas Ativos</option>
            <option value="inactive">Apenas Inativos</option>
          </NativeSelectDropdown>
        </div>
        </div>
      </section>

      {/* Tabela de Usuários */}
      <section aria-label="Diretório de usuários" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Diretório da equipe</h2>
            <p className="mt-0.5 text-xs text-slate-500">Lotações, papéis e acessos por colaborador.</p>
          </div>
          {!isLoading && <span className="text-xs font-medium text-slate-400">Exibindo {filteredUsers.length} de {users.length}</span>}
        </div>
        {isLoading ? (
          <SystemLoadingState label="Carregando colaboradores..." />
        ) : filteredUsers.length === 0 ? (
          <SystemEmptyState icon={Users} title="Nenhum colaborador encontrado" description="Tente ajustar os filtros ou cadastre um novo usuário." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full divide-y divide-slate-100">
              <caption className="sr-only">Usuários e colaboradores cadastrados</caption>
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Colaborador
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Lotação / Unidade
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Funções Globais
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Áreas Alocadas & Permissões
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Criado em
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((u) => {
                  const userAreaNames = userAreasMap.get(u.id) || [];

                  return (
                    <tr key={u.id} className="transition-colors hover:bg-indigo-50/25">
                      {/* Colaborador */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/app/users/${u.id}`)}
                          className="group text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        >
                          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                            <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200 group-hover:bg-indigo-100 group-hover:text-indigo-700">{u.fullName.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
                            {u.fullName}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </button>
                      </td>

                      {/* Lotação */}
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
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
                      <td className="px-5 py-4">
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
                      <td className="px-5 py-4">
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
                      <td className="whitespace-nowrap px-5 py-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Criado em */}
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Ações */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
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
                          {canResetPasswords && (
                            <button
                              type="button"
                              disabled={!recoverableUserIds.includes(u.id)}
                              onClick={() => navigate(`/app/password-recovery?userId=${encodeURIComponent(u.id)}`)}
                              aria-label={`Resetar senha de ${u.fullName}`}
                              title={recoverableUserIds.includes(u.id) ? 'Gerar uma senha temporária para este acesso' : 'Este acesso não permite redefinição pelo seu perfil'}
                              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                            >
                              <KeyRound className="h-4 w-4" />
                              Resetar senha
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
