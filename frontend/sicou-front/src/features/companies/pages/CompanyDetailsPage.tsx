import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Layers3,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CompanyUnitsSection } from '../../units/components';
import { getCompanyById } from '../api';
import type { Company } from '../types';

function formatDate(value?: string | null) {
  if (!value) {
    return 'Não informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function CompanyDetailsPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompany() {
      if (!companyId) {
        setErrorMessage('Empresa não informada.');
        setIsLoading(false);
        return;
      }

      try {
        setErrorMessage(null);
        setIsLoading(true);

        const data = await getCompanyById(companyId);

        setCompany(data);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Não foi possível carregar os dados da empresa.';

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadCompany();
  }, [companyId]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
        Carregando empresa...
      </div>
    );
  }

  if (errorMessage || !company || !companyId) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-red-600">
          {errorMessage ?? 'Empresa não encontrada.'}
        </p>

        <button
          type="button"
          onClick={() => navigate('/app/companies')}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para empresas
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            to="/app/companies"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para empresas
          </Link>

          <p className="mt-6 text-sm font-medium text-slate-500">
            Empresa
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {company.name}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Visualize os dados da empresa e acesse suas unidades e áreas.
          </p>
        </div>

        {company.isActive ? (
          <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Ativa
          </span>
        ) : (
          <span className="inline-flex w-fit rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
            Inativa
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Nome
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {company.name}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <FileText className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Documento
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {company.document || 'Não informado'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <Calendar className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Criada em
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatDate(company.createdAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <Calendar className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Atualizada em
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatDate(company.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <CompanyUnitsSection companyId={companyId} />

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <Layers3 className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Áreas da sede
              </h2>

              <p className="text-sm text-slate-500">
                Depois vamos listar áreas e seus módulos habilitados.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            CRUD de áreas será implementado após unidades.
          </div>
        </div>
      </div>
    </div>
  );
}