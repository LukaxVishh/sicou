import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { getCompanies } from '../../companies/api';
import { getAreasByCompanyId } from '../../areas/api';
import { getUnitsByCompanyId } from '../../units/api';
import { getUsers } from '../../users/api';
import type { Company } from '../../companies/types';
import type { CompanyArea } from '../../areas/types';
import type { Unit } from '../../units/types';
import type { User } from '../../users/types';
import { createAccess } from '../api';

type CreateAccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  defaultCompanyId?: string;
};

export function CreateAccessModal({
  isOpen,
  onClose,
  onCreated,
  defaultCompanyId,
}: CreateAccessModalProps) {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.roles.includes(SystemRoles.SuperAdmin) ?? false;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    defaultCompanyId || currentUser?.companyId || '',
  );

  const [users, setUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const [canView, setCanView] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [canPublishInformatives, setCanPublishInformatives] = useState(false);
  const [canManageGuide, setCanManageGuide] = useState(false);
  const [canManageWorkflows, setCanManageWorkflows] = useState(false);
  const [canHandleWorkflowRequests, setCanHandleWorkflowRequests] = useState(false);

  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, isSuperAdmin, currentUser?.companyId]);

  useEffect(() => {
    if (!isOpen || !selectedCompanyId) {
      setUsers([]);
      setAreas([]);
      setUnits([]);
      return;
    }

    let isMounted = true;
    setIsLoadingDependencies(true);

    Promise.all([
      getUsers(),
      getAreasByCompanyId(selectedCompanyId),
      getUnitsByCompanyId(selectedCompanyId),
    ])
      .then(([usersData, areasData, unitsData]: [User[], CompanyArea[], Unit[]]) => {
        if (!isMounted) return;

        // Filtrar usuários da empresa selecionada (ou sem empresa se superadmin)
        const filteredUsers = usersData.filter(
          (u: User) => u.isActive && (u.companyId === selectedCompanyId || (!u.companyId && isSuperAdmin)),
        );
        setUsers(filteredUsers);
        if (filteredUsers.length > 0) setSelectedUserId(filteredUsers[0].id);

        const activeAreas = areasData.filter((a: CompanyArea) => a.isActive);
        setAreas(activeAreas);
        if (activeAreas.length > 0) setSelectedAreaId(activeAreas[0].id);

        const activeUnits = unitsData.filter((u: Unit) => u.isActive);
        setUnits(activeUnits);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar dados complementares.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingDependencies(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedCompanyId, isSuperAdmin]);

  if (!isOpen) {
    return null;
  }

  function resetForm() {
    setSelectedUserId('');
    setSelectedAreaId('');
    setSelectedUnitId('');
    setCanView(true);
    setCanManage(false);
    setCanPublishInformatives(false);
    setCanManageGuide(false);
    setCanManageWorkflows(false);
    setCanHandleWorkflowRequests(false);
    setErrorMessage(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCompanyId) {
      setErrorMessage('Selecione uma empresa.');
      return;
    }

    if (!selectedUserId) {
      setErrorMessage('Selecione um usuário.');
      return;
    }

    if (!selectedAreaId) {
      setErrorMessage('Selecione uma área da sede.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await createAccess({
        userId: selectedUserId,
        companyId: selectedCompanyId,
        areaId: selectedAreaId,
        unitId: selectedUnitId || null,
        canView,
        canManage,
        canPublishInformatives,
        canManageGuide,
        canManageWorkflows,
        canHandleWorkflowRequests,
      });

      await onCreated();
      resetForm();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível conceder o acesso.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Conceder permissões por área
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure o acesso granular de um colaborador a uma área da sede.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {errorMessage && (
            <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          {isSuperAdmin && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700">
                Empresa *
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                required
              >
                <option value="">Selecione a empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Usuário *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                required
                disabled={isLoadingDependencies}
              >
                <option value="">Selecione o usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Área da sede *
              </label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                required
                disabled={isLoadingDependencies}
              >
                <option value="">Selecione a área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700">
              Unidade (Opcional / Escopo de filial)
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={isLoadingDependencies}
            >
              <option value="">Geral / Todas as unidades</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.code ? `(${u.code})` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Deixe em branco caso a permissão deva se aplicar a nível de sede ou sem restrição de unidade.
            </p>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Permissões concedidas
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Marque os privilégios operacionais que este usuário terá dentro desta área:
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={canView}
                  onChange={(e) => setCanView(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Visualizar Área</p>
                  <p className="text-xs text-slate-500">Acesso para consultar dados e itens da área.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={canManage}
                  onChange={(e) => setCanManage(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gerenciar Área</p>
                  <p className="text-xs text-slate-500">Acesso para alterar configurações e módulos.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={canPublishInformatives}
                  onChange={(e) => setCanPublishInformatives(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Publicar Informativos</p>
                  <p className="text-xs text-slate-500">Criar e publicar comunicados setoriais.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={canManageGuide}
                  onChange={(e) => setCanManageGuide(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gerenciar Orientador</p>
                  <p className="text-xs text-slate-500">Cadastrar manuais, links e tutoriais.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={canManageWorkflows}
                  onChange={(e) => setCanManageWorkflows(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gerenciar Workflows</p>
                  <p className="text-xs text-slate-500">Criar e configurar fluxos e etapas.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={canHandleWorkflowRequests}
                  onChange={(e) => setCanHandleWorkflowRequests(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Tratar Solicitações</p>
                  <p className="text-xs text-slate-500">Analisar, aprovar ou rejeitar chamados da área.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingDependencies}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando...' : 'Conceder acesso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
