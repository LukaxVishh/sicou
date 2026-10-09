import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  KeyRound,
  Layers,
  Plus,
  RefreshCcw,
  Save,
  Shield,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { getCompanies } from '../../companies/api';
import type { Company } from '../../companies/types';
import { getUnitsByCompanyId } from '../../units/api';
import type { Unit } from '../../units/types';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import { getUserById, updateUser, updateUserRoles } from '../api';
import type { User, UserRole } from '../types';
import {
  createAccess,
  deleteAccess,
  getAccessesByUser,
  updateAccess,
} from '../../access-control/api';
import type { UserAreaAccess } from '../../access-control/types';

const roleOptions: Array<{
  value: UserRole;
  label: string;
  badgeColor: string;
  description: string;
}> = [
  {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    badgeColor: 'bg-purple-50 text-purple-700 ring-purple-200',
    description: 'Acesso total e irrestrito a todas as empresas, configurações e infraestrutura do sistema.',
  },
  {
    value: 'COMPANY_ADMIN',
    label: 'Admin da Empresa',
    badgeColor: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    description: 'Administra a empresa, suas filiais, áreas, colaboradores e parametrizações globais corporativas.',
  },
  {
    value: 'AREA_ADMIN',
    label: 'Admin de Área',
    badgeColor: 'bg-blue-50 text-blue-700 ring-blue-200',
    description: 'Gestor responsável pela administração das áreas vinculadas, criação de fluxos de trabalho e publicações.',
  },
  {
    value: 'HEADQUARTER_USER',
    label: 'Usuário da Sede',
    badgeColor: 'bg-amber-50 text-amber-700 ring-amber-200',
    description: 'Colaborador lotado na sede da empresa, com visibilidade e atuação inter-unidades conforme permissões.',
  },
  {
    value: 'UNIT_USER',
    label: 'Usuário de Unidade',
    badgeColor: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    description: 'Colaborador restrito à sua filial de alocação, visualizando apenas processos e dados da sua respectiva unidade.',
  },
];

function formatDate(value?: string | null) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.roles.includes(SystemRoles.SuperAdmin) ?? false;

  // Estado dos Dados Principais
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [accesses, setAccesses] = useState<UserAreaAccess[]>([]);

  // Estados dos Formulários
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);

  // Estados de Nova Permissão de Área (Inline Modal / Drawer)
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [newAreaId, setNewAreaId] = useState('');
  const [newUnitId, setNewUnitId] = useState('');
  const [newCanView, setNewCanView] = useState(true);
  const [newCanManage, setNewCanManage] = useState(false);
  const [newCanPublishInformatives, setNewCanPublishInformatives] = useState(false);
  const [newCanManageGuide, setNewCanManageGuide] = useState(false);
  const [newCanManageWorkflows, setNewCanManageWorkflows] = useState(false);
  const [newCanHandleWorkflowRequests, setNewCanHandleWorkflowRequests] = useState(false);
  const [isSubmittingNewArea, setIsSubmittingNewArea] = useState(false);

  // Estados de Carregamento e Notificações
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [savingAccessId, setSavingAccessId] = useState<string | null>(null);
  const [deletingAccessId, setDeletingAccessId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 1. Carregar Dados Iniciais
  const loadUserDetails = useCallback(async (options?: { silent?: boolean }) => {
    if (!userId) return;

    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setFeedbackMessage(null);

      // Buscar usuário e permissões em paralelo
      const [userData, userAccesses] = await Promise.all([
        getUserById(userId),
        getAccessesByUser(userId).catch(() => [] as UserAreaAccess[]),
      ]);

      setUser(userData);
      setFullName(userData.fullName);
      setEmail(userData.email);
      setCompanyId(userData.companyId ?? '');
      setUnitId(userData.unitId ?? '');
      setIsActive(userData.isActive);
      setRoles(userData.roles);
      setAccesses(userAccesses.filter((a) => a.isActive));

      const targetCompanyId = userData.companyId || currentUser?.companyId;

      // Buscar empresas, unidades e áreas relacionadas
      const promises: Promise<any>[] = [];
      if (isSuperAdmin) {
        promises.push(getCompanies().catch(() => [] as Company[]));
      }
      if (targetCompanyId) {
        promises.push(getUnitsByCompanyId(targetCompanyId).catch(() => [] as Unit[]));
        promises.push(getAreasByCompanyId(targetCompanyId).catch(() => [] as CompanyArea[]));
      }

      const results = await Promise.all(promises);
      let idx = 0;
      if (isSuperAdmin) {
        setCompanies(results[idx++] || []);
      }
      if (targetCompanyId) {
        setUnits(results[idx++] || []);
        const loadedAreas: CompanyArea[] = results[idx++] || [];
        setAreas(loadedAreas.filter((a) => a.isActive));
      }
    } catch (error) {
      setFeedbackMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar detalhes do colaborador.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, currentUser?.companyId, isSuperAdmin]);

  useEffect(() => {
    loadUserDetails();
  }, [loadUserDetails]);

  // Se trocar a empresa (para Super Admin), recarregar unidades e áreas
  const handleCompanyChange = async (newCompId: string) => {
    setCompanyId(newCompId);
    setUnitId('');
    if (newCompId) {
      try {
        const [unitsData, areasData] = await Promise.all([
          getUnitsByCompanyId(newCompId).catch(() => [] as Unit[]),
          getAreasByCompanyId(newCompId).catch(() => [] as CompanyArea[]),
        ]);
        setUnits(unitsData);
        setAreas(areasData.filter((a) => a.isActive));
      } catch {
        setUnits([]);
        setAreas([]);
      }
    } else {
      setUnits([]);
      setAreas([]);
    }
  };

  // Toggle de Roles
  const handleToggleRole = (role: UserRole) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  // 2. Salvar Dados Cadastrais & Papéis
  const handleSaveUserData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userId) return;

    setIsSavingUser(true);
    setFeedbackMessage(null);

    try {
      // 1. Atualizar dados básicos
      const updatedUser = await updateUser(userId, {
        fullName: fullName.trim(),
        email: email.trim(),
        companyId: companyId ? companyId : null,
        unitId: unitId ? unitId : null,
        isActive,
      });

      // 2. Atualizar papéis (roles)
      await updateUserRoles(userId, {
        roles,
      });

      setUser({
        ...updatedUser,
        roles,
      });

      setFeedbackMessage({
        type: 'success',
        text: 'Dados cadastrais e funções do colaborador foram salvos com sucesso!',
      });
    } catch (error) {
      setFeedbackMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao salvar dados do colaborador.',
      });
    } finally {
      setIsSavingUser(false);
    }
  };

  // 3. Atualizar Permissão Específica de Área Existente
  const handleToggleAccessPermission = async (
    access: UserAreaAccess,
    field: keyof Pick<
      UserAreaAccess,
      | 'canView'
      | 'canManage'
      | 'canPublishInformatives'
      | 'canManageGuide'
      | 'canManageWorkflows'
      | 'canHandleWorkflowRequests'
    >,
  ) => {
    setSavingAccessId(access.id);
    setFeedbackMessage(null);

    const updatedPayload = {
      canView: field === 'canView' ? !access.canView : access.canView,
      canManage: field === 'canManage' ? !access.canManage : access.canManage,
      canPublishInformatives:
        field === 'canPublishInformatives'
          ? !access.canPublishInformatives
          : access.canPublishInformatives,
      canManageGuide:
        field === 'canManageGuide' ? !access.canManageGuide : access.canManageGuide,
      canManageWorkflows:
        field === 'canManageWorkflows'
          ? !access.canManageWorkflows
          : access.canManageWorkflows,
      canHandleWorkflowRequests:
        field === 'canHandleWorkflowRequests'
          ? !access.canHandleWorkflowRequests
          : access.canHandleWorkflowRequests,
    };

    try {
      const updated = await updateAccess(access.id, updatedPayload);
      setAccesses((prev) =>
        prev.map((item) => (item.id === access.id ? { ...item, ...updated } : item)),
      );
      setFeedbackMessage({
        type: 'success',
        text: `Permissões na área "${access.areaName}" atualizadas com sucesso!`,
      });
    } catch (error) {
      setFeedbackMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : `Erro ao atualizar permissão na área ${access.areaName}.`,
      });
    } finally {
      setSavingAccessId(null);
    }
  };

  // 4. Remover / Inativar Vínculo de Área
  const handleDeleteAccess = async (accessId: string, areaName: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja revogar o vínculo e todas as permissões do colaborador na área "${areaName}"?`,
      )
    ) {
      return;
    }

    setDeletingAccessId(accessId);
    setFeedbackMessage(null);

    try {
      await deleteAccess(accessId);
      setAccesses((prev) => prev.filter((a) => a.id !== accessId));
      setFeedbackMessage({
        type: 'success',
        text: `Vínculo com a área "${areaName}" revogado com sucesso.`,
      });
    } catch (error) {
      setFeedbackMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao revogar vínculo de área.',
      });
    } finally {
      setDeletingAccessId(null);
    }
  };

  // 5. Vincular Nova Área ao Usuário
  const handleAddNewAreaAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newAreaId) return;

    const targetCompanyId = companyId || currentUser?.companyId;
    if (!targetCompanyId) {
      setFeedbackMessage({
        type: 'error',
        text: 'Selecione uma empresa antes de vincular permissões.',
      });
      return;
    }

    setIsSubmittingNewArea(true);
    setFeedbackMessage(null);

    try {
      await createAccess({
        userId,
        companyId: targetCompanyId,
        areaId: newAreaId,
        unitId: newUnitId ? newUnitId : undefined,
        canView: newCanView,
        canManage: newCanManage,
        canPublishInformatives: newCanPublishInformatives,
        canManageGuide: newCanManageGuide,
        canManageWorkflows: newCanManageWorkflows,
        canHandleWorkflowRequests: newCanHandleWorkflowRequests,
      });

      // Recarregar acessos para garantir que nomes de área/unidade venham preenchidos
      const updatedList = await getAccessesByUser(userId);
      setAccesses(updatedList.filter((a) => a.isActive));

      setIsAddingArea(false);
      setNewAreaId('');
      setNewUnitId('');
      setNewCanView(true);
      setNewCanManage(false);
      setNewCanPublishInformatives(false);
      setNewCanManageGuide(false);
      setNewCanManageWorkflows(false);
      setNewCanHandleWorkflowRequests(false);

      setFeedbackMessage({
        type: 'success',
        text: 'Nova área e permissões vinculadas com sucesso ao colaborador!',
      });
    } catch (error) {
      setFeedbackMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao vincular área ao colaborador.',
      });
    } finally {
      setIsSubmittingNewArea(false);
    }
  };

  // Iniciais do Usuário para Avatar
  const userInitials = useMemo(() => {
    if (!fullName) return 'US';
    return fullName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [fullName]);

  // Áreas disponíveis para adicionar vínculo (que ainda não possuem acesso cadastrado)
  const availableAreasToAdd = useMemo(() => {
    const linkedAreaIds = new Set(accesses.map((a) => a.areaId));
    return areas.filter((a) => !linkedAreaIds.has(a.id));
  }, [areas, accesses]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-xs font-semibold text-slate-500">Carregando dados do colaborador...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-2 text-base font-bold text-rose-900">Colaborador não encontrado</h2>
          <p className="mt-1 text-xs text-rose-700">
            O usuário solicitado não existe ou você não possui permissão para visualizá-lo.
          </p>
          <Link
            to="/app/users"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para lista de usuários
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* 1. Barra de Navegação Superior */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/users')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Usuários
          </button>
          <span className="text-xs font-medium text-slate-400">/</span>
          <span className="text-xs font-bold text-slate-600">Editar Perfil Completo</span>
        </div>

        <div className="flex items-center gap-2">
          {user.isActive && user.id !== currentUser?.id && !user.roles.includes('SUPER_ADMIN')
            && (isSuperAdmin || (currentUser?.roles.includes(SystemRoles.CompanyAdmin) && !user.roles.includes('COMPANY_ADMIN'))) && (
            <Link to={`/app/password-recovery?userId=${user.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <KeyRound className="h-4 w-4" /> Recuperar senha
            </Link>
          )}
          <button
            type="button"
            onClick={() => loadUserDetails({ silent: true })}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            title="Recarregar dados"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={handleSaveUserData}
            disabled={isSavingUser}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSavingUser ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Alterações
          </button>
        </div>
      </div>

      {/* Alertas de Notificação / Feedback */}
      {feedbackMessage && (
        <div
          className={`flex items-start justify-between gap-3 rounded-2xl p-4 text-xs font-semibold shadow-sm transition-all ${
            feedbackMessage.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Header / Cartão de Visão Geral do Usuário */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-xl font-black text-indigo-200 ring-2 ring-indigo-400/30 backdrop-blur-sm sm:h-20 sm:w-20 sm:text-2xl">
              {userInitials}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {fullName || 'Nome não informado'}
                </h1>
                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Conta Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-0.5 text-xs font-bold text-rose-300 ring-1 ring-rose-400/30 backdrop-blur-sm">
                    Inativo no Sistema
                  </span>
                )}
              </div>

              <p className="text-xs font-medium text-slate-300 sm:text-sm">{email}</p>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-slate-200">
                  <Building2 className="h-3.5 w-3.5 text-indigo-300" />
                  {user.companyName || 'Empresa Geral'}
                </span>

                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-slate-200">
                  <Layers className="h-3.5 w-3.5 text-indigo-300" />
                  {user.unitName ? user.unitName : 'Sede Corporativa'}
                </span>

                <span className="text-slate-400">
                  Cadastrado em {formatDate(user.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1.5 border-t border-white/10 pt-4 sm:border-0 sm:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Vínculos com Áreas
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/30 px-3.5 py-1.5 text-sm font-black text-indigo-200 ring-1 ring-indigo-400/30">
              <ShieldCheck className="h-4 w-4 text-indigo-300" />
              {accesses.length} {accesses.length === 1 ? 'área atribuída' : 'áreas atribuídas'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUNA ESQUERDA: DADOS CADASTRAIS & FUNÇÕES (7 COLUNAS) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card 1: Dados Cadastrais & Unidade */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">1. Dados Cadastrais & Alocação</h2>
                <p className="text-xs text-slate-500">
                  Informações de identificação e lotação corporativa.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUserData} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    E-mail Corporativo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="joao.silva@empresa.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Empresa */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">Empresa Vinculada</label>
                  {isSuperAdmin ? (
                    <select
                      value={companyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Sem empresa associada</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      {user.companyName || 'Empresa Atual'}
                    </div>
                  )}
                </div>

                {/* Unidade / Filial */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Unidade de Lotação
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Sede Corporativa (Nenhuma filial)</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.code ? `(${u.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status da Conta */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="flex cursor-pointer items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900">
                      Status da Conta do Usuário
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Quando inativo, o colaborador perde o acesso a todos os portais e sistemas.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>
            </form>
          </div>

          {/* Card 2: Funções Globais no Sistema (Roles) */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    2. Funções Globais no Sistema (Papéis)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Selecione as funções e perfis de atuação deste colaborador.
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                {roles.length} {roles.length === 1 ? 'papel' : 'papéis'}
              </span>
            </div>

            <div className="mt-5 space-y-2.5">
              {roleOptions
                .filter((r) => r.value !== 'SUPER_ADMIN' || isSuperAdmin)
                .map((role) => {
                  const isChecked = roles.includes(role.value);

                  return (
                    <label
                      key={role.value}
                      onClick={() => handleToggleRole(role.value)}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // tratado no onClick do container
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{role.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${role.badgeColor}`}
                          >
                            {role.value}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                          {role.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleSaveUserData}
                disabled={isSavingUser}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSavingUser ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Dados & Funções
              </button>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: PERMISSÕES GRANULARES POR ÁREA DA SEDE (5 COLUNAS) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    3. Permissões por Área da Sede
                  </h2>
                  <p className="text-xs text-slate-500">
                    Controle fino de módulos e privilégios por departamento.
                  </p>
                </div>
              </div>

              {!isAddingArea && (
                <button
                  type="button"
                  onClick={() => setIsAddingArea(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Vincular Área
                </button>
              )}
            </div>

            {/* FORMULÁRIO DE NOVA PERMISSÃO DE ÁREA */}
            {isAddingArea && (
              <form
                onSubmit={handleAddNewAreaAccess}
                className="mt-4 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/30 p-4 space-y-3.5 animate-fadeIn"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-900">
                    Conceder Nova Permissão de Área
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingArea(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Área da Sede <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newAreaId}
                    onChange={(e) => setNewAreaId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione uma área...</option>
                    {availableAreasToAdd.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name} {area.description ? `— ${area.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Restringir à Unidade (Opcional)
                  </label>
                  <select
                    value={newUnitId}
                    onChange={(e) => setNewUnitId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todas as Unidades (Escopo Global / Sede)</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Flags de Permissão */}
                <div className="space-y-2 pt-1">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Privilégios Habilitados
                  </span>

                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCanView}
                      onChange={(e) => setNewCanView(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Visualizar área e murais de notícias</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCanPublishInformatives}
                      onChange={(e) => setNewCanPublishInformatives(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Publicar comunicados e informativos</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCanManageWorkflows}
                      onChange={(e) => setNewCanManageWorkflows(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Criar e gerenciar fluxos / processos</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCanHandleWorkflowRequests}
                      onChange={(e) => setNewCanHandleWorkflowRequests(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Atender e tramitar solicitações de processos</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCanManageGuide}
                      onChange={(e) => setNewCanManageGuide(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Gerenciar base de conhecimento e orientador</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCanManage}
                      onChange={(e) => setNewCanManage(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Gerenciar configurações gerais da área</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingArea(false)}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNewArea || !newAreaId}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmittingNewArea ? (
                      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Confirmar Vínculo
                  </button>
                </div>
              </form>
            )}

            {/* LISTAGEM DE ÁREAS VINCULADAS */}
            <div className="mt-4 space-y-4">
              {accesses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center">
                  <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-bold text-slate-700">
                    Nenhuma área vinculada individualmente.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    O acesso a módulos dependerá exclusivamente dos papéis globais do usuário.
                  </p>
                  {!isAddingArea && (
                    <button
                      type="button"
                      onClick={() => setIsAddingArea(true)}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Vincular área agora
                    </button>
                  )}
                </div>
              ) : (
                accesses.map((access) => {
                  const isSavingThis = savingAccessId === access.id;
                  const isDeletingThis = deletingAccessId === access.id;

                  return (
                    <div
                      key={access.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:bg-slate-50"
                    >
                      {/* Header do Card de Área */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {access.areaName}
                            </span>
                            {access.unitName ? (
                              <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                Filial: {access.unitName}
                              </span>
                            ) : (
                              <span className="rounded-md bg-indigo-100/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                Escopo Geral
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Vínculo ativo desde {formatDate(access.createdAt)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteAccess(access.id, access.areaName)}
                          disabled={isDeletingThis}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Revogar vínculo com esta área"
                        >
                          {isDeletingThis ? (
                            <RefreshCcw className="h-4 w-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Toggles Interativos das 6 Permissões */}
                      <div className="mt-3 space-y-2">
                        {/* 1. canView */}
                        <label className="flex items-center justify-between cursor-pointer rounded-lg p-1 hover:bg-white/80 transition text-xs">
                          <span className="text-slate-700 font-medium">Visualizar Área & Mural</span>
                          <input
                            type="checkbox"
                            checked={access.canView}
                            disabled={isSavingThis}
                            onChange={() => handleToggleAccessPermission(access, 'canView')}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>

                        {/* 2. canPublishInformatives */}
                        <label className="flex items-center justify-between cursor-pointer rounded-lg p-1 hover:bg-white/80 transition text-xs">
                          <span className="text-slate-700 font-medium">Publicar Informativos</span>
                          <input
                            type="checkbox"
                            checked={access.canPublishInformatives}
                            disabled={isSavingThis}
                            onChange={() =>
                              handleToggleAccessPermission(access, 'canPublishInformatives')
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>

                        {/* 3. canManageWorkflows */}
                        <label className="flex items-center justify-between cursor-pointer rounded-lg p-1 hover:bg-white/80 transition text-xs">
                          <span className="text-slate-700 font-medium">Criar / Gerenciar Fluxos</span>
                          <input
                            type="checkbox"
                            checked={access.canManageWorkflows}
                            disabled={isSavingThis}
                            onChange={() =>
                              handleToggleAccessPermission(access, 'canManageWorkflows')
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>

                        {/* 4. canHandleWorkflowRequests */}
                        <label className="flex items-center justify-between cursor-pointer rounded-lg p-1 hover:bg-white/80 transition text-xs">
                          <span className="text-slate-700 font-medium">Atender Solicitações</span>
                          <input
                            type="checkbox"
                            checked={access.canHandleWorkflowRequests}
                            disabled={isSavingThis}
                            onChange={() =>
                              handleToggleAccessPermission(access, 'canHandleWorkflowRequests')
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>

                        {/* 5. canManageGuide */}
                        <label className="flex items-center justify-between cursor-pointer rounded-lg p-1 hover:bg-white/80 transition text-xs">
                          <span className="text-slate-700 font-medium">Gerenciar Orientador</span>
                          <input
                            type="checkbox"
                            checked={access.canManageGuide}
                            disabled={isSavingThis}
                            onChange={() =>
                              handleToggleAccessPermission(access, 'canManageGuide')
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>

                        {/* 6. canManage */}
                        <label className="flex items-center justify-between cursor-pointer rounded-lg p-1 hover:bg-white/80 transition text-xs">
                          <span className="text-slate-700 font-medium">Administrar Área</span>
                          <input
                            type="checkbox"
                            checked={access.canManage}
                            disabled={isSavingThis}
                            onChange={() => handleToggleAccessPermission(access, 'canManage')}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>
                      </div>

                      {isSavingThis && (
                        <div className="mt-2 text-right text-[10px] font-semibold text-indigo-600 animate-pulse">
                          Salvando alteração...
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
