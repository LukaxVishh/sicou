import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { SelectDropdown } from '../../../shared/components';
import { getCompanies } from '../../companies/api';
import type { Company } from '../../companies/types';
import { getUnitsByCompanyId } from '../../units/api';
import type { Unit } from '../../units/types';
import { updateUser, updateUserRoles } from '../api';
import type { User, UserRole } from '../types';

type EditUserModalProps = {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

type EditUserFormProps = {
  user: User;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

const roleOptions: Array<{
  value: UserRole;
  label: string;
  description: string;
}> = [
  {
    value: 'SUPER_ADMIN',
    label: 'Super admin',
    description: 'Acesso administrativo global ao sistema.',
  },
  {
    value: 'COMPANY_ADMIN',
    label: 'Admin da empresa',
    description: 'Administra dados relacionados à empresa vinculada.',
  },
  {
    value: 'AREA_ADMIN',
    label: 'Admin da área',
    description: 'Administra áreas específicas conforme permissões.',
  },
  {
    value: 'HEADQUARTER_USER',
    label: 'Usuário da sede',
    description: 'Usuário vinculado à sede da empresa.',
  },
  {
    value: 'UNIT_USER',
    label: 'Usuário da unidade',
    description: 'Usuário vinculado a uma unidade específica.',
  },
];

function EditUserForm({ user, onClose, onUpdated }: EditUserFormProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [companyId, setCompanyId] = useState(user.companyId ?? '');
  const [unitId, setUnitId] = useState(user.unitId ?? '');
  const [isActive, setIsActive] = useState(user.isActive);
  const [roles, setRoles] = useState<UserRole[]>(user.roles);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [isCompaniesLoading, setIsCompaniesLoading] = useState(true);
  const [isUnitsLoading, setIsUnitsLoading] = useState(Boolean(user.companyId));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        setIsCompaniesLoading(false);
      });

    if (user.companyId) {
      getUnitsByCompanyId(user.companyId)
        .then((data) => {
          if (!isMounted) {
            return;
          }

          setUnits(data);
          setErrorMessage(null);
        })
        .catch((error) => {
          if (!isMounted) {
            return;
          }

          const message = error instanceof Error
            ? error.message
            : 'Não foi possível carregar as unidades da empresa.';

          setErrorMessage(message);
        })
        .finally(() => {
          if (!isMounted) {
            return;
          }

          setIsUnitsLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [user.companyId]);

  function handleToggleRole(role: UserRole) {
    setRoles((current) => {
      if (current.includes(role)) {
        return current.filter((item) => item !== role);
      }

      return [...current, role];
    });
  }

  function handleCompanyChange(value: string) {
    setCompanyId(value);
    setUnitId('');
    setUnits([]);

    if (!value) {
      return;
    }

    setIsUnitsLoading(true);

    getUnitsByCompanyId(value)
      .then((data) => {
        setUnits(data);
        setErrorMessage(null);
      })
      .catch((error) => {
        const message = error instanceof Error
          ? error.message
          : 'Não foi possível carregar as unidades da empresa.';

        setErrorMessage(message);
      })
      .finally(() => {
        setIsUnitsLoading(false);
      });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (roles.length === 0) {
      setErrorMessage('Selecione pelo menos uma função para o usuário.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await updateUser(user.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        companyId: companyId || null,
        unitId: unitId || null,
        isActive,
      });

      await updateUserRoles(user.id, {
        roles,
      });

      await onUpdated();

      onClose();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Não foi possível atualizar o usuário.';

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Editar usuário
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Atualize os dados, vínculos, status e funções do usuário.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-5"
        >
          {errorMessage && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-user-full-name"
                className="block text-sm font-medium text-slate-700"
              >
                Nome completo
              </label>

              <input
                id="edit-user-full-name"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                required
              />
            </div>

            <div>
              <label
                htmlFor="edit-user-email"
                className="block text-sm font-medium text-slate-700"
              >
                E-mail
              </label>

              <input
                id="edit-user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                required
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Empresa
              </label>

              <SelectDropdown
                value={companyId}
                onChange={handleCompanyChange}
                disabled={isCompaniesLoading}
                placeholder={isCompaniesLoading ? 'Carregando...' : 'Não vincular'}
                ariaLabel="Selecionar empresa"
                options={[
                  {
                    value: '',
                    label: 'Não vincular',
                  },
                  ...companies.map((company) => ({
                    value: company.id,
                    label: company.name,
                    description: company.document || undefined,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Unidade
              </label>

              <SelectDropdown
                value={unitId}
                onChange={setUnitId}
                disabled={!companyId || isUnitsLoading}
                placeholder={
                  isUnitsLoading
                    ? 'Carregando...'
                    : companyId
                      ? 'Não vincular'
                      : 'Selecione uma empresa'
                }
                ariaLabel="Selecionar unidade"
                options={[
                  {
                    value: '',
                    label: companyId ? 'Não vincular' : 'Selecione uma empresa',
                  },
                  ...units.map((unit) => ({
                    value: unit.id,
                    label: unit.name,
                    description: unit.code || undefined,
                  })),
                ]}
              />
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Usuário ativo
              </p>

              <p className="text-xs text-slate-500">
                Usuários inativos continuam cadastrados, mas ficam marcados como inativos.
              </p>
            </div>
          </label>

          <div className="mt-5">
            <p className="block text-sm font-medium text-slate-700">
              Funções
            </p>

            <div className="mt-3 grid gap-3">
              {roleOptions.map((role) => {
                const isChecked = roles.includes(role.value);

                return (
                  <label
                    key={role.value}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleRole(role.value)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {role.label}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {role.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditUserModal({
  user,
  isOpen,
  onClose,
  onUpdated,
}: EditUserModalProps) {
  if (!isOpen || !user) {
    return null;
  }

  return (
    <EditUserForm
      key={user.id}
      user={user}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
}