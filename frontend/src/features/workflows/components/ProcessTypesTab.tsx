import React, { useState, useMemo } from 'react';
import {
  Plus,
  GitBranch,
  CheckCircle2,
  Shield,
  Search,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ProcessTypeSummary } from '../types';
import {
  ProcessAudience,
  isDraftStatus,
  isHomologatedStatus,
} from '../types';
import { SystemEmptyState } from '../../../shared/components';

interface ProcessTypesTabProps {
  areaId: string;
  processTypes: ProcessTypeSummary[];
  onRefresh: () => void;
  canManage: boolean;
}

interface ProcessTreeItem {
  familyId: string;
  code: string;
  name: string;
  description?: string;
  targetAudience: number;
  activeVersion?: ProcessTypeSummary;
  draftVersion?: ProcessTypeSummary;
  totalVersions: number;
  primaryVersionId: string;
  latestCreatedAt: string;
}

export const ProcessTypesTab: React.FC<ProcessTypesTabProps> = ({
  areaId,
  processTypes,
  onRefresh,
  canManage,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Agrupar versões nas árvores de processos principais
  const treeList = useMemo<ProcessTreeItem[]>(() => {
    const groupsMap = new Map<string, ProcessTypeSummary[]>();

    processTypes.forEach((pt) => {
      const key = pt.familyId || pt.code || pt.id;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(pt);
    });

    const result: ProcessTreeItem[] = [];

    groupsMap.forEach((versions, familyId) => {
      const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
      const active = sorted.find((v) => isHomologatedStatus(v.status));
      const draft = sorted.find((v) => isDraftStatus(v.status));
      const reference = active || draft || sorted[0];

      result.push({
        familyId,
        code: reference.code,
        name: reference.name,
        description: reference.description,
        targetAudience: reference.targetAudience,
        activeVersion: active,
        draftVersion: draft,
        totalVersions: sorted.length,
        primaryVersionId: active?.id || draft?.id || sorted[0].id,
        latestCreatedAt: sorted[0]?.createdAt || '',
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [processTypes]);

  // Filtrar busca
  const filteredTrees = useMemo(() => {
    if (!searchQuery.trim()) return treeList;
    const q = searchQuery.toLowerCase();
    return treeList.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [treeList, searchQuery]);

  const handleOpenCreate = () => {
    navigate(`/app/workflows/trees/new?areaId=${areaId}`);
  };

  const handleNavigateToDetails = (treeId: string) => {
    navigate(`/app/workflows/trees/${treeId}`);
  };

  const getAudienceLabel = (aud: number) => {
    if (aud === ProcessAudience.HeadquartersOnly) return 'Apenas Sede';
    if (aud === ProcessAudience.UnitsOnly) return 'Apenas Unidades';
    return 'Sede & Unidades';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Principal da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            Árvores de Decisão & Processos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestão dos fluxos de trabalho da área. Selecione uma árvore para gerenciar versões, auditar alterações e editar o grafo de decisão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-2xs"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl transition shadow-xs text-xs font-bold shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Árvore de Processo</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca e Métricas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar árvore por nome ou identificador..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
          <span>{treeList.length} árvores cadastradas</span>
          <span>•</span>
          <span>{processTypes.length} versões registradas</span>
        </div>
      </div>

      {/* Listagem Limpa e Objetiva das Árvores de Processo */}
      {filteredTrees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white">
          <SystemEmptyState compact icon={GitBranch} title={searchQuery ? 'Nenhuma árvore encontrada' : 'Nenhuma árvore cadastrada'} description={searchQuery ? 'Não encontramos árvores para o termo pesquisado.' : 'Esta área ainda não possui árvores de processo.'} action={canManage && !searchQuery ? (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition mt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar Primeira Árvore
            </button>
          ) : undefined} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-5">Árvore de Decisão / Identificador</th>
                  <th className="py-3.5 px-4">Público Alvo</th>
                  <th className="py-3.5 px-4">Versão Homologada (Ativa)</th>
                  <th className="py-3.5 px-4 text-center">Total Versões</th>
                  <th className="py-3.5 px-4">Última Atualização</th>
                  <th className="py-3.5 px-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTrees.map((tree) => {
                  const hasActive = !!tree.activeVersion;
                  const hasDraft = !!tree.draftVersion;

                  return (
                    <tr
                      key={tree.familyId}
                      onClick={() => handleNavigateToDetails(tree.primaryVersionId)}
                      className="hover:bg-indigo-50/20 transition-colors cursor-pointer group"
                    >
                      {/* Nome e Código */}
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-xl shrink-0 mt-0.5 shadow-2xs ${
                              hasActive
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : hasDraft
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <GitBranch className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {tree.name}
                              </span>
                              <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {tree.code}
                              </span>
                            </div>
                            {tree.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 max-w-md">
                                {tree.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Público Alvo */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/70">
                          <Shield className="w-3 h-3 text-slate-400" />
                          {getAudienceLabel(tree.targetAudience)}
                        </span>
                      </td>

                      {/* Status da Versão Ativa */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {hasActive ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Versão {tree.activeVersion!.versionNumber}
                            </span>
                            {hasDraft && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
                                title="Existe nova versão em rascunho de criação"
                              >
                                <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                                v{tree.draftVersion!.versionNumber} em criação
                              </span>
                            )}
                          </div>
                        ) : hasDraft ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Rascunho v{tree.draftVersion!.versionNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Sem versão ativa
                          </span>
                        )}
                      </td>

                      {/* Total de Versões */}
                      <td className="py-4 px-4 whitespace-nowrap text-center">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                          {tree.totalVersions} {tree.totalVersions === 1 ? 'versão' : 'versões'}
                        </span>
                      </td>

                      {/* Data de Criação / Versão */}
                      <td className="py-4 px-4 whitespace-nowrap text-[11px] text-slate-500">
                        {tree.latestCreatedAt ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(tree.latestCreatedAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Botão de Navegação para a Página Dedicada */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToDetails(tree.primaryVersionId);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-2xs group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600"
                        >
                          <span>Detalhes da Árvore</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
