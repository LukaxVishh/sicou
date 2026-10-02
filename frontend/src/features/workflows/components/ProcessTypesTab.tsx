import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Play,
  GitBranch,
  CheckCircle2,
  GitMerge,
  Shield,
  Trash2,
  Eye,
  History,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ProcessTypeSummary, ProcessType } from '../types';
import {
  ProcessAudience,
  isDraftStatus,
  isHomologatedStatus,
  isArchivedStatus,
} from '../types';
import * as workflowsApi from '../api';
import { ProcessSimulatorModal } from './ProcessSimulatorModal';

interface ProcessTypesTabProps {
  areaId: string;
  processTypes: ProcessTypeSummary[];
  onRefresh: () => void;
  canManage: boolean;
}

interface ProcessTreeGroup {
  familyId: string;
  code: string;
  name: string;
  description?: string;
  targetAudience: number;
  activeVersion?: ProcessTypeSummary;
  draftVersion?: ProcessTypeSummary;
  archivedVersions: ProcessTypeSummary[];
  allVersions: ProcessTypeSummary[];
  totalVersions: number;
  latestCreatedAt: string;
}

export const ProcessTypesTab: React.FC<ProcessTypesTabProps> = ({
  areaId,
  processTypes,
  onRefresh,
  canManage,
}) => {
  const navigate = useNavigate();
  const [selectedProcessTypeForDebug, setSelectedProcessTypeForDebug] = useState<ProcessType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  // Agrupar as versões em Famílias / Árvores de Processo
  const treeGroups = useMemo<ProcessTreeGroup[]>(() => {
    const groupsMap = new Map<string, ProcessTypeSummary[]>();

    processTypes.forEach((pt) => {
      const key = pt.familyId || pt.code || pt.id;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(pt);
    });

    const result: ProcessTreeGroup[] = [];

    groupsMap.forEach((versions, familyId) => {
      // Ordenar versões do maior para o menor número de versão
      const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

      const active = sorted.find((v) => isHomologatedStatus(v.status));
      const draft = sorted.find((v) => isDraftStatus(v.status));
      const archived = sorted.filter((v) => isArchivedStatus(v.status));

      // Usar a versão ativa como referência principal de nome/descrição, ou a mais recente
      const reference = active || draft || sorted[0];

      result.push({
        familyId,
        code: reference.code,
        name: reference.name,
        description: reference.description,
        targetAudience: reference.targetAudience,
        activeVersion: active,
        draftVersion: draft,
        archivedVersions: archived,
        allVersions: sorted,
        totalVersions: sorted.length,
        latestCreatedAt: sorted[0]?.createdAt || '',
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [processTypes]);

  // Filtrar pela busca
  const filteredTreeGroups = useMemo(() => {
    if (!searchQuery.trim()) return treeGroups;
    const q = searchQuery.toLowerCase();
    return treeGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [treeGroups, searchQuery]);

  const toggleExpand = (familyId: string) => {
    setExpandedFamilies((prev) => ({
      ...prev,
      [familyId]: !prev[familyId],
    }));
  };

  const handleOpenCreate = () => {
    navigate(`/app/workflows/trees/new?areaId=${areaId}`);
  };

  const handleOpenBuilder = (summary: ProcessTypeSummary) => {
    navigate(`/app/workflows/trees/${summary.id}?areaId=${areaId}`);
  };

  const handleOpenDebug = async (summary: ProcessTypeSummary) => {
    try {
      const full = await workflowsApi.getProcessTypeById(summary.id);
      setSelectedProcessTypeForDebug(full);
    } catch (err: any) {
      alert(err?.message || 'Erro ao carregar simulador.');
    }
  };

  const handleCloneVersion = async (summary: ProcessTypeSummary) => {
    if (
      !window.confirm(
        `Deseja criar uma nova versão (v${summary.versionNumber + 1}) clonando a estrutura atual de "${summary.name}"?`
      )
    )
      return;
    try {
      const cloned = await workflowsApi.cloneProcessTypeVersion(summary.id);
      onRefresh();
      // Expandir o grupo automaticamente
      setExpandedFamilies((prev) => ({ ...prev, [summary.familyId]: true }));
      navigate(`/app/workflows/trees/${cloned.id}?areaId=${areaId}`);
    } catch (err: any) {
      alert(err?.message || 'Erro ao clonar versão.');
    }
  };

  const handleNewVersionFromScratch = async (summary: ProcessTypeSummary) => {
    if (
      !window.confirm(
        `Deseja iniciar uma nova versão (v${summary.versionNumber + 1}) do zero para "${summary.name}"?`
      )
    )
      return;
    try {
      const created = await workflowsApi.createNewVersionFromScratch(summary.id);
      onRefresh();
      setExpandedFamilies((prev) => ({ ...prev, [summary.familyId]: true }));
      navigate(`/app/workflows/trees/${created.id}?areaId=${areaId}`);
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar nova versão do zero.');
    }
  };

  const handleHomologate = async (id: string, familyId: string) => {
    if (
      !window.confirm(
        'Confirma a homologação desta árvore? Ela passará a ser a versão oficial para abertura de chamados pela sede e unidades, e a versão homologada anterior será inativada.'
      )
    )
      return;
    try {
      await workflowsApi.homologateProcessType(id);
      if (selectedProcessTypeForDebug?.id === id) {
        setSelectedProcessTypeForDebug(null);
      }
      setExpandedFamilies((prev) => ({ ...prev, [familyId]: true }));
      onRefresh();
      alert('Árvore de processo homologada com sucesso para produção!');
    } catch (err: any) {
      alert(err?.message || 'Erro ao homologar árvore.');
    }
  };

  const handleInactivate = async (summary: ProcessTypeSummary) => {
    if (
      !window.confirm(
        `Deseja inativar a versão (v${summary.versionNumber}) de "${summary.name}"? Novos chamados não poderão ser abertos até que uma nova versão seja homologada.`
      )
    )
      return;
    try {
      await workflowsApi.inactivateProcessType(summary.id);
      if (selectedProcessTypeForDebug?.id === summary.id) {
        setSelectedProcessTypeForDebug(null);
      }
      setExpandedFamilies((prev) => ({ ...prev, [summary.familyId]: true }));
      onRefresh();
      alert('Versão da árvore inativada com sucesso.');
    } catch (err: any) {
      alert(err?.message || 'Erro ao inativar árvore.');
    }
  };

  const handleDeleteDraft = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente excluir o rascunho da versão em criação de "${name}"?`)) return;
    try {
      await workflowsApi.deleteProcessType(id);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir rascunho.');
    }
  };

  const getAudienceLabel = (aud: number) => {
    if (aud === ProcessAudience.HeadquartersOnly) return 'Apenas Sede';
    if (aud === ProcessAudience.UnitsOnly) return 'Apenas Unidades';
    return 'Sede & Unidades';
  };

  return (
    <div className="space-y-6">
      {/* Header Principal da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            Árvores de Processos da Área
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Lista de fluxos cadastrados. Expanda cada árvore para gerenciar sua versão ativa em produção, rascunhos em criação e histórico de versões inativas.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Nova Árvore de Processo
          </button>
        )}
      </div>

      {/* Barra de Busca e Estatísticas Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar árvore por nome ou código..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
          <span>{treeGroups.length} árvores cadastradas</span>
          <span>•</span>
          <span>{processTypes.length} versões no total</span>
        </div>
      </div>

      {/* Lista de Árvores de Processo */}
      <div className="space-y-4">
        {filteredTreeGroups.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold space-y-2">
            <GitBranch className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p>
              {searchQuery
                ? 'Nenhuma árvore de processo encontrada para a busca.'
                : 'Nenhuma árvore de processo cadastrada para esta área.'}
            </p>
            {canManage && !searchQuery && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Criar a Primeira Árvore
              </button>
            )}
          </div>
        ) : (
          filteredTreeGroups.map((group) => {
            const isExpanded = !!expandedFamilies[group.familyId];
            const hasActive = !!group.activeVersion;
            const hasDraft = !!group.draftVersion;
            const hasArchived = group.archivedVersions.length > 0;

            return (
              <div
                key={group.familyId}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                  isExpanded ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Linha Principal da Árvore de Processo (Header do Item) */}
                <div
                  onClick={() => toggleExpand(group.familyId)}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition select-none"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${
                        hasActive
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : hasDraft
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      <GitBranch className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm md:text-base">
                          {group.name}
                        </h3>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                          {group.code}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                          <Shield className="w-3 h-3 text-slate-400" />
                          {getAudienceLabel(group.targetAudience)}
                        </span>
                      </div>

                      {group.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {group.description}
                        </p>
                      )}

                      {/* Badges de Versões Disponíveis nesta Árvore */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {hasActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Versão Ativa: v{group.activeVersion!.versionNumber}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Sem Versão Ativa
                          </span>
                        )}

                        {hasDraft && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            <Sparkles className="w-3 h-3" />
                            Rascunho: v{group.draftVersion!.versionNumber} em criação
                          </span>
                        )}

                        {hasArchived && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <History className="w-3 h-3 text-slate-400" />
                            {group.archivedVersions.length} inativa(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                    {/* Ações Rápidas na Linha e Botão de Expandir */}
                  <div
                    className="flex items-center gap-2 shrink-0 self-end lg:self-center pt-2 lg:pt-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasActive && (
                      <button
                        type="button"
                        onClick={() => handleOpenDebug(group.activeVersion!)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition shadow-2xs"
                        title="Simular a Versão Ativa deste Processo"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Simular Ativa
                      </button>
                    )}

                    {hasDraft && canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenBuilder(group.draftVersion!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition shadow-2xs"
                          title="Continuar Editando Rascunho"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Editar Rascunho
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHomologate(group.draftVersion!.id, group.familyId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-2xs"
                          title="Homologar Rascunho para Produção"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Homologar
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(group.familyId)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                        isExpanded
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{isExpanded ? 'Recolher' : 'Detalhar Versões'}</span>
                      <span className="text-[10px] opacity-80">({group.totalVersions})</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* PAINEL DE DETALHAMENTO EXPANDIDO POR ÁRVORE */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/60 p-5 md:p-6 space-y-6 animate-fadeIn">
                    
                    {/* 1. SEÇÃO: VERSÃO ATIVA (HOMOLOGADA) */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Versão Oficial Ativa em Produção
                        </h4>
                        {hasActive && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Usada pela sede e unidades para abertura de chamados
                          </span>
                        )}
                      </div>

                      {hasActive ? (
                        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                v{group.activeVersion!.versionNumber}
                              </span>
                              <span className="font-bold text-slate-800 text-xs md:text-sm">
                                {group.activeVersion!.name}
                              </span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-600">
                                <strong>{group.activeVersion!.nodesCount}</strong> etapas •{' '}
                                <strong>{group.activeVersion!.fieldsCount}</strong> campos
                              </span>
                            </div>
                            {group.activeVersion!.description && (
                              <p className="text-xs text-slate-500">
                                {group.activeVersion!.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDebug(group.activeVersion!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
                              title="Testar e simular fluxo"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Simular
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenBuilder(group.activeVersion!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                              title="Visualizar Grafo da Versão Ativa"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver Grafo
                            </button>

                            {canManage && (
                              <>
                                {!hasDraft ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleCloneVersion(group.activeVersion!)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition shadow-2xs"
                                      title="Criar nova versão rascunho clonando esta base"
                                    >
                                      <GitMerge className="w-3.5 h-3.5" />
                                      Nova Versão (Clonar Base)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleNewVersionFromScratch(group.activeVersion!)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                                      title="Iniciar nova versão a partir do zero"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Nova Versão (Do Zero)
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                    Existe um rascunho em criação (v{group.draftVersion!.versionNumber})
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleInactivate(group.activeVersion!)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
                                  title="Inativar versão ativa"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  Inativar Árvore
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-slate-500">
                            <AlertCircle className="w-4 h-4 text-slate-400" />
                            <span>Esta árvore não possui nenhuma versão homologada ativa no momento.</span>
                          </div>
                          {hasDraft && canManage && (
                            <button
                              type="button"
                              onClick={() => handleHomologate(group.draftVersion!.id, group.familyId)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Homologar Rascunho v{group.draftVersion!.versionNumber}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. SEÇÃO: VERSÃO EM CRIAÇÃO (RASCUNHO / DRAFT) */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Versão em Criação / Rascunho
                      </h4>

                      {hasDraft ? (
                        <div className="bg-white rounded-xl border border-amber-300 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                                v{group.draftVersion!.versionNumber}
                              </span>
                              <span className="font-bold text-slate-800 text-xs md:text-sm">
                                {group.draftVersion!.name}
                              </span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-600">
                                <strong>{group.draftVersion!.nodesCount}</strong> etapas •{' '}
                                <strong>{group.draftVersion!.fieldsCount}</strong> campos
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Em edição. Você pode sair e voltar a qualquer momento mantendo o fluxo atual.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => handleOpenBuilder(group.draftVersion!)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-2xs"
                                title="Continuar Edição no Construtor Visual"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Continuar Edição
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenDebug(group.draftVersion!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
                              title="Testar rascunho no Simulador"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Simular
                            </button>

                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleHomologate(group.draftVersion!.id, group.familyId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-2xs"
                                  title="Homologar esta versão para Produção"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Homologar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteDraft(group.draftVersion!.id, group.draftVersion!.name)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                                  title="Excluir Rascunho"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-3.5 text-xs text-slate-500 flex items-center justify-between">
                          <span>Nenhum rascunho em criação para esta árvore no momento.</span>
                          {canManage && hasActive && (
                            <button
                              type="button"
                              onClick={() => handleCloneVersion(group.activeVersion!)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                            >
                              <Plus className="w-3 h-3" />
                              Iniciar Nova Versão
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. SEÇÃO: VERSÕES INATIVAS / HISTÓRICAS */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-slate-500" />
                        Versões Inativas / Histórico ({group.archivedVersions.length})
                      </h4>

                      {hasArchived ? (
                        <div className="space-y-2">
                          {group.archivedVersions.map((archived) => (
                            <div
                              key={archived.id}
                              className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                  v{archived.versionNumber}
                                </span>
                                <span className="font-semibold text-slate-700">
                                  {archived.name}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-500">
                                  {archived.nodesCount} etapas • {archived.fieldsCount} campos
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                                  Inativa
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenBuilder(archived)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                                  title="Ver Grafo Histórico"
                                >
                                  <Eye className="w-3 h-3" />
                                  Ver Histórico
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenDebug(archived)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                                  title="Simular versão histórica"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  Simular
                                </button>

                                {canManage && !hasDraft && (
                                  <button
                                    type="button"
                                    onClick={() => handleCloneVersion(archived)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                                    title="Usar esta versão antiga como base para uma nova"
                                  >
                                    <GitMerge className="w-3 h-3" />
                                    Restaurar como Base
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-3 text-xs text-slate-400 text-center sm:text-left">
                          Nenhuma versão histórica inativa para este fluxo.
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Simulador / Modo Debug */}
      {selectedProcessTypeForDebug && (
        <ProcessSimulatorModal
          processType={selectedProcessTypeForDebug}
          onClose={() => setSelectedProcessTypeForDebug(null)}
          onHomologate={
            isDraftStatus(selectedProcessTypeForDebug.status)
              ? () => handleHomologate(selectedProcessTypeForDebug.id, selectedProcessTypeForDebug.familyId)
              : undefined
          }
        />
      )}
    </div>
  );
};
