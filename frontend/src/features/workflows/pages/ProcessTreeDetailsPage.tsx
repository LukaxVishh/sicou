import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  GitBranch,
  Play,
  Copy,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  AlertCircle,
  Shield,
  History,
  Sparkles,
  ExternalLink,
  Ban,
  X,
} from 'lucide-react';
import * as workflowsApi from '../api';
import type { ProcessType, ProcessTypeSummary } from '../types';
import {
  ProcessAudience,
  isDraftStatus,
  isHomologatedStatus,
} from '../types';
import { SelectDropdown } from '../../../shared/components/SelectDropdown';
import { ProcessSimulatorModal } from '../components/ProcessSimulatorModal';
import { resolveNodeTheme } from '../components/WorkflowCustomNode';

export const ProcessTreeDetailsPage: React.FC = () => {
  const { treeId, id } = useParams<{ treeId?: string; id?: string }>();
  const activeTreeId = treeId || id;
  const navigate = useNavigate();

  // Estados de Carregamento e Dados
  const [currentTree, setCurrentTree] = useState<ProcessType | null>(null);
  const [areaVersions, setAreaVersions] = useState<ProcessTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal Simulador
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Modais Flutuantes Centralizados de Confirmação
  const [confirmModal, setConfirmModal] = useState<{
    type: 'homologate' | 'inactivate' | 'deleteDraft' | 'clone' | 'scratch';
    versionId: string;
    versionNumber: number;
    title: string;
    description: string;
    confirmText: string;
    confirmColor: string;
  } | null>(null);

  // 1. Carregar detalhes da árvore atual e de todas as versões da mesma família
  const loadTreeDetails = useCallback(async (targetId: string) => {
    setLoading(true);
    setError(null);

    try {
      const tree = await workflowsApi.getProcessTypeById(targetId);
      setCurrentTree(tree);

      // Buscar todos os processos da área para correlacionar a família de versões
      const allAreaTypes = await workflowsApi.getProcessTypesByAreaId(tree.areaId);
      const targetFamilyKey = tree.familyId || tree.code;
      const related = allAreaTypes.filter(
        (t) => (t.familyId || t.code) === targetFamilyKey
      );

      // Ordenar por número de versão decrescente
      related.sort((a, b) => b.versionNumber - a.versionNumber);
      setAreaVersions(related);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar os detalhes da árvore de decisão.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTreeId) {
      loadTreeDetails(activeTreeId);
    }
  }, [activeTreeId, loadTreeDetails]);

  // Versão homologada de referência
  const activeVersion = useMemo(() => {
    return areaVersions.find((v) => isHomologatedStatus(v.status));
  }, [areaVersions]);

  // Seletor de versão
  const versionOptions = useMemo(() => {
    return areaVersions.map((v) => {
      const isHom = isHomologatedStatus(v.status);
      const isDft = isDraftStatus(v.status);
      const statusLabel = isHom
        ? 'Homologada (Ativa)'
        : isDft
        ? 'Rascunho (Em criação)'
        : 'Inativa (Arquivada)';
      return {
        value: v.id,
        label: `Versão ${v.versionNumber} — ${statusLabel}`,
        description: `Criada em ${new Date(v.createdAt).toLocaleDateString('pt-BR')}`,
      };
    });
  }, [areaVersions]);

  const handleSelectVersion = (versionId: string) => {
    if (versionId !== currentTree?.id) {
      navigate(`/app/workflows/trees/${versionId}`);
    }
  };

  const getAudienceLabel = (aud: number) => {
    if (aud === ProcessAudience.HeadquartersOnly) return 'Apenas Sede';
    if (aud === ProcessAudience.UnitsOnly) return 'Apenas Unidades';
    return 'Sede & Unidades';
  };

  // Execução de ações confirmadas
  const handleExecuteConfirmedAction = async () => {
    if (!confirmModal || !currentTree) return;

    setActionLoading(true);
    try {
      if (confirmModal.type === 'homologate') {
        await workflowsApi.homologateProcessType(confirmModal.versionId);
        setConfirmModal(null);
        await loadTreeDetails(confirmModal.versionId);
      } else if (confirmModal.type === 'inactivate') {
        await workflowsApi.inactivateProcessType(confirmModal.versionId);
        setConfirmModal(null);
        await loadTreeDetails(confirmModal.versionId);
      } else if (confirmModal.type === 'deleteDraft') {
        await workflowsApi.deleteProcessType(confirmModal.versionId);
        setConfirmModal(null);
        // Se a versão atual foi deletada, redirecionar para a homologada ou lista
        if (activeVersion && activeVersion.id !== confirmModal.versionId) {
          navigate(`/app/workflows/trees/${activeVersion.id}`);
        } else {
          navigate('/app/workflows');
        }
      } else if (confirmModal.type === 'clone') {
        const cloned = await workflowsApi.cloneProcessTypeVersion(confirmModal.versionId);
        setConfirmModal(null);
        navigate(`/app/workflows/trees/${cloned.id}/builder?areaId=${currentTree.areaId}`);
      } else if (confirmModal.type === 'scratch') {
        const created = await workflowsApi.createNewVersionFromScratch(confirmModal.versionId);
        setConfirmModal(null);
        navigate(`/app/workflows/trees/${created.id}/builder?areaId=${currentTree.areaId}`);
      }
    } catch (err: any) {
      alert(err?.message || 'Ocorreu um erro ao executar a ação solicitada.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
          Carregando detalhes da árvore...
        </p>
      </div>
    );
  }

  if (!currentTree) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Árvore não encontrada</h2>
        <p className="text-xs text-slate-500">
          Não foi possível encontrar a árvore de decisão solicitada.
        </p>
        <button
          onClick={() => navigate('/app/workflows')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Central de Processos
        </button>
      </div>
    );
  }

  const isCurrentHomologated = isHomologatedStatus(currentTree.status);
  const isCurrentDraft = isDraftStatus(currentTree.status);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* ========================================================================= */}
      {/* HEADER DA PÁGINA DEDICADA DE DETALHES DA ÁRVORE                           */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/70 pb-5">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/app/workflows')}
            className="p-2.5 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80 rounded-2xl transition-all shadow-2xs hover:shadow-xs group"
            title="Voltar para a lista de árvores de processos"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200/70 shadow-2xs">
                {currentTree.code}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5 shadow-2xs ${
                  isCurrentHomologated
                    ? 'text-emerald-900 bg-emerald-50 border-emerald-300'
                    : isCurrentDraft
                    ? 'text-amber-800 bg-amber-50 border-amber-200 animate-pulse'
                    : 'text-slate-700 bg-slate-100 border-slate-300'
                }`}
              >
                {isCurrentHomologated ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Versão Homologada (Ativa em Produção)
                  </>
                ) : isCurrentDraft ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Versão em Criação (Rascunho)
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Versão Inativa (Histórica)
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                <Shield className="w-3 h-3 text-slate-400" />
                {getAudienceLabel(currentTree.targetAudience)}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5">
              {currentTree.name}
            </h1>
            {currentTree.description && (
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                {currentTree.description}
              </p>
            )}
          </div>
        </div>

        {/* Seletor Rápido de Versão no Topo */}
        <div className="w-full md:w-72 shrink-0 space-y-1">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Alternar Versão da Árvore
          </label>
          <SelectDropdown
            value={currentTree.id}
            options={versionOptions}
            onChange={handleSelectVersion}
            placeholder="Selecione uma versão"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO PRINCIPAL: CARDS DE AÇÕES RÁPIDAS & RESUMO ESTRUTURAL DA ÁRVORE    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo (8 colunas): Estrutura e Etapas da Versão Atual */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card de Estatísticas da Versão */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50/80 text-indigo-600 rounded-2xl ring-1 ring-indigo-100/80 shadow-2xs">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Estrutura da Versão {currentTree.versionNumber}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Visão quantitativa de nós, formulários e regras desta árvore.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/app/workflows/trees/${currentTree.id}/builder?areaId=${currentTree.areaId}`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow transition-all group"
              >
                <GitBranch className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>{isCurrentDraft ? 'Editar Grafo no Construtor' : 'Visualizar Grafo do Fluxo'}</span>
              </button>
            </div>

            {/* Grid 3x Métricas */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Etapas / Nós
                </span>
                <span className="font-mono text-2xl font-black text-slate-800">
                  {currentTree.nodes.length}
                </span>
              </div>
              <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Campos no Form
                </span>
                <span className="font-mono text-2xl font-black text-slate-800">
                  {currentTree.fields.length}
                </span>
              </div>
              <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Transições / Arestas
                </span>
                <span className="font-mono text-2xl font-black text-slate-800">
                  {currentTree.transitions.length}
                </span>
              </div>
            </div>

            {/* Lista das Etapas com Categorização de Cor */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                Etapas Cadastradas neste Fluxo
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentTree.nodes.map((node, idx) => {
                  const theme = resolveNodeTheme({
                    id: node.id || node.processNodeId,
                    label: node.name,
                    code: node.code,
                    nodeType: node.nodeType,
                    fieldsCount: 0,
                  });

                  return (
                    <div
                      key={node.processNodeId || idx}
                      className="p-3.5 rounded-2xl border bg-white hover:bg-slate-50/60 transition-all flex items-start gap-3 shadow-2xs"
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 shadow-xs ${theme.headerBg}`}
                        title={theme.badgeText}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-xs text-slate-800 truncate">
                            {node.name}
                          </p>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-2xs shrink-0 ${theme.badgeClass}`}
                          >
                            {theme.badgeText}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          #{node.code || 'ETAPA'} • Ordem {node.order}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Histórico Consolidado de Versões (Ativa, Criação e Inativas) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-indigo-50/80 text-indigo-600 rounded-2xl ring-1 ring-indigo-100/80 shadow-2xs">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Histórico de Versões da Árvore
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Acompanhamento de todas as versões homologadas, em criação e inativas.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {areaVersions.map((ver) => {
                const isHom = isHomologatedStatus(ver.status);
                const isDft = isDraftStatus(ver.status);
                const isSelected = ver.id === currentTree.id;

                return (
                  <div
                    key={ver.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50/20 ring-1 ring-indigo-500/20'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-2xs ${
                          isHom
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isDft
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}
                      >
                        v{ver.versionNumber}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-800">
                            Versão {ver.versionNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isHom
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isDft
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {isHom
                              ? 'Homologada / Ativa'
                              : isDft
                              ? 'Em Criação (Rascunho)'
                              : 'Inativa (Arquivada)'}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                              Selecionada
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Criada em {new Date(ver.createdAt).toLocaleDateString('pt-BR')} • {ver.nodesCount} etapas • {ver.fieldsCount} campos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!isSelected && (
                        <button
                          type="button"
                          onClick={() => handleSelectVersion(ver.id)}
                          className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl transition shadow-2xs"
                        >
                          Inspecionar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(`/app/workflows/trees/${ver.id}/builder?areaId=${currentTree.areaId}`)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Grafo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Painel Direito (4 colunas): Ações Rápidas, Governança e Auditoria */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card de Ações Rápidas da Árvore */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Ações Rápidas do Fluxo
            </h3>

            <div className="space-y-2.5">
              {/* Botão Construtor Visual */}
              <button
                type="button"
                onClick={() => navigate(`/app/workflows/trees/${currentTree.id}/builder?areaId=${currentTree.areaId}`)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/80 text-indigo-950 font-bold text-xs transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <GitBranch className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span>Abrir no Construtor Visual</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              {/* Botão Simular */}
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(true)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 text-emerald-950 font-bold text-xs transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Play className="w-4 h-4 text-emerald-600 fill-current group-hover:scale-110 transition-transform" />
                  <span>Simulador Interativo do Fluxo</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              </button>

              {/* Gerar Nova Versão a partir desta (Clonar) */}
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    type: 'clone',
                    versionId: currentTree.id,
                    versionNumber: currentTree.versionNumber,
                    title: 'Clonar para Nova Versão',
                    description: `Deseja gerar uma nova versão em rascunho (v${areaVersions[0]?.versionNumber ? areaVersions[0].versionNumber + 1 : currentTree.versionNumber + 1}) copiando integralmente a estrutura de nós, coordenadas espaciais e regras desta versão?`,
                    confirmText: 'Confirmar e Abrir no Construtor',
                    confirmColor: 'bg-indigo-600 hover:bg-indigo-700',
                  })
                }
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4 text-slate-500 group-hover:scale-110 transition-transform" />
                  <span>Gerar Nova Versão (Clonar)</span>
                </div>
                <Plus className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Criar Nova Versão do Zero */}
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    type: 'scratch',
                    versionId: currentTree.id,
                    versionNumber: currentTree.versionNumber,
                    title: 'Nova Versão do Zero',
                    description: `Deseja iniciar uma nova versão limpa (v${areaVersions[0]?.versionNumber ? areaVersions[0].versionNumber + 1 : currentTree.versionNumber + 1}) mantendo apenas o nó inicial de confecção protegido?`,
                    confirmText: 'Criar do Zero',
                    confirmColor: 'bg-indigo-600 hover:bg-indigo-700',
                  })
                }
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="w-4 h-4 text-slate-500 group-hover:scale-110 transition-transform" />
                  <span>Nova Versão (Do Zero)</span>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Ações de Estado da Versão Selecionada */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Ciclo de Vida desta Versão
              </span>

              {isCurrentDraft && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmModal({
                        type: 'homologate',
                        versionId: currentTree.id,
                        versionNumber: currentTree.versionNumber,
                        title: 'Homologar Árvore para Produção',
                        description: `Confirma a homologação da Versão ${currentTree.versionNumber}? Ela passará a ser a versão oficial para abertura de novos chamados e a versão homologada anterior será inativada.`,
                        confirmText: 'Homologar para Produção',
                        confirmColor: 'bg-emerald-600 hover:bg-emerald-700',
                      })
                    }
                    className="w-full inline-flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Homologar para Produção</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmModal({
                        type: 'deleteDraft',
                        versionId: currentTree.id,
                        versionNumber: currentTree.versionNumber,
                        title: 'Descartar Rascunho',
                        description: `Deseja realmente excluir a versão em criação (v${currentTree.versionNumber}) de "${currentTree.name}"? Esta ação não pode ser desfeita.`,
                        confirmText: 'Sim, Descartar Rascunho',
                        confirmColor: 'bg-rose-600 hover:bg-rose-700',
                      })
                    }
                    className="w-full inline-flex items-center justify-center gap-2 p-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Descartar Rascunho</span>
                  </button>
                </>
              )}

              {isCurrentHomologated && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmModal({
                      type: 'inactivate',
                      versionId: currentTree.id,
                      versionNumber: currentTree.versionNumber,
                      title: 'Inativar Versão Homologada',
                      description: `Deseja inativar a Versão ${currentTree.versionNumber}? Novos chamados não poderão ser abertos por esta árvore até que uma nova versão seja homologada.`,
                      confirmText: 'Inativar Versão',
                      confirmColor: 'bg-amber-600 hover:bg-amber-700',
                    })
                  }
                  className="w-full inline-flex items-center justify-center gap-2 p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition"
                >
                  <Ban className="w-4 h-4 text-amber-600" />
                  <span>Inativar Versão em Produção</span>
                </button>
              )}
            </div>
          </div>

          {/* Trilha de Auditoria da Árvore */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Trilha de Auditoria</span>
            </h3>

            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 pl-6 text-xs">
              <div className="relative space-y-0.5">
                <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                <p className="font-bold text-slate-800">Criação da Versão {currentTree.versionNumber}</p>
                <p className="text-[11px] text-slate-400">
                  {new Date(currentTree.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>

              {currentTree.updatedAt && (
                <div className="relative space-y-0.5">
                  <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                  <p className="font-bold text-slate-800">Última Atualização Registrada</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(currentTree.updatedAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}

              {isCurrentHomologated && (
                <div className="relative space-y-0.5">
                  <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-white" />
                  <p className="font-bold text-slate-800">Status Vigente: Homologada</p>
                  <p className="text-[11px] text-slate-400">
                    Disponibilizada para abertura pela sede e filiais.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL SIMULADOR INTERATIVO                                                */}
      {/* ========================================================================= */}
      {isSimulatorOpen && (
        <ProcessSimulatorModal
          processType={currentTree}
          onClose={() => setIsSimulatorOpen(false)}
          onHomologate={() => {
            setIsSimulatorOpen(false);
            loadTreeDetails(currentTree.id);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL FLUTUANTE CENTRALIZADO DE CONFIRMAÇÃO (HOMOLOGAÇÃO, CLONE, INATIVAÇÃO)*/}
      {/* ========================================================================= */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 transform transition-all duration-200 ease-out scale-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="font-bold text-sm text-slate-900">
                {confirmModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {confirmModal.description}
              </p>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleExecuteConfirmedAction}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition disabled:opacity-50 ${confirmModal.confirmColor}`}
                >
                  {actionLoading ? 'Processando...' : confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
