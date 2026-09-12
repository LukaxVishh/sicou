import {
  BookOpen,
  CheckCircle2,
  FolderTree,
  HelpCircle,
  Layers3,
  RefreshCcw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';

type CompanyGuideSectionProps = {
  companyId: string;
};

export function CompanyGuideSection({ companyId }: CompanyGuideSectionProps) {
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAreas = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const data = await getAreasByCompanyId(companyId);
      setAreas(data.filter((a) => a.isActive));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível carregar os dados das áreas.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  const guideAreas = areas.filter((a) =>
    a.modules.some((m) => m.code === 'Guide' && m.enabled),
  );

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Orientadores e Procedimentos Operacionais
            </h2>
            <p className="text-sm text-slate-500">
              Guias normativos, manuais e bases de conhecimento mantidos pelas áreas da sede
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadAreas({ silent: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Carregando orientadores das áreas...
        </div>
      ) : guideAreas.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Nenhuma área com o módulo Orientador habilitado.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Habilite o módulo Orientador nas áreas da sede para cadastrar manuais e tutoriais.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guideAreas.map((area) => (
            <div
              key={area.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-slate-50 hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                    <BookOpen className="h-3.5 w-3.5" />
                    Orientador Ativo
                  </span>
                  <span className="text-xs font-mono text-slate-400">/{area.slug}</span>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900">
                  {area.name}
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {area.description || 'Guias, tutoriais e procedimentos padrão do setor.'}
                </p>

                <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Manuais e procedimentos normativos</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <FolderTree className="h-4 w-4 text-blue-600" />
                    <span>Hierarquia de tópicos e categorias</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <HelpCircle className="h-4 w-4 text-purple-600" />
                    <span>Perguntas frequentes e diretrizes</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-3">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <Layers3 className="h-3.5 w-3.5 text-slate-500" />
                  Módulo pronto para alimentação setorial
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
