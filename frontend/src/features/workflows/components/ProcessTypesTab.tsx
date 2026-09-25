import React, { useState } from 'react';
import { Plus, Edit2, Play, GitBranch, CheckCircle2, GitMerge, AlertCircle, Shield } from 'lucide-react';
import type { ProcessTypeSummary, ProcessType, ProcessNode, FieldDefinition, CreateProcessTypePayload } from '../types';
import { ProcessTypeStatus, ProcessAudience } from '../types';
import * as workflowsApi from '../api';
import { ProcessTreeBuilderModal } from './ProcessTreeBuilderModal';
import { ProcessSimulatorModal } from './ProcessSimulatorModal';

interface ProcessTypesTabProps {
  areaId: string;
  processTypes: ProcessTypeSummary[];
  availableNodes: ProcessNode[];
  availableFields: FieldDefinition[];
  onRefresh: () => void;
  canManage: boolean;
}

export const ProcessTypesTab: React.FC<ProcessTypesTabProps> = ({
  areaId,
  processTypes,
  availableNodes,
  availableFields,
  onRefresh,
  canManage,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProcessTypeForEdit, setSelectedProcessTypeForEdit] = useState<ProcessType | null>(null);
  const [selectedProcessTypeForDebug, setSelectedProcessTypeForDebug] = useState<ProcessType | null>(null);

  // Form states para criação inicial
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState<number>(ProcessAudience.All);
  const [startNodeId, setStartNodeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setCode('');
    setName('');
    setDescription('');
    setTargetAudience(ProcessAudience.All);
    setStartNodeId(availableNodes[0]?.id || '');
    setError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: CreateProcessTypePayload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        targetAudience: targetAudience as any,
        startNodeId: startNodeId || undefined,
      };

      const created = await workflowsApi.createProcessType(areaId, payload);
      setIsCreateModalOpen(false);
      onRefresh();
      // Abrir builder para configurar os nodos e campos do novo rascunho
      setSelectedProcessTypeForEdit(created);
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar tipo de processo.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBuilder = async (summary: ProcessTypeSummary) => {
    try {
      const full = await workflowsApi.getProcessTypeById(summary.id);
      setSelectedProcessTypeForEdit(full);
    } catch (err: any) {
      alert(err?.message || 'Erro ao carregar detalhes do processo.');
    }
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
    if (!window.confirm(`Deseja criar uma nova versão (v${summary.versionNumber + 1}) para "${summary.name}"?`)) return;
    try {
      const cloned = await workflowsApi.cloneProcessTypeVersion(summary.id);
      onRefresh();
      setSelectedProcessTypeForEdit(cloned);
    } catch (err: any) {
      alert(err?.message || 'Erro ao clonar versão.');
    }
  };

  const handleHomologate = async (id: string) => {
    if (!window.confirm('Confirma a homologação desta árvore? Ela passará a ser a versão oficial para abertura de novos chamados.')) return;
    try {
      await workflowsApi.homologateProcessType(id);
      if (selectedProcessTypeForDebug?.id === id) {
        setSelectedProcessTypeForDebug(null);
      }
      onRefresh();
      alert('Árvore de processo homologada com sucesso!');
    } catch (err: any) {
      alert(err?.message || 'Erro ao homologar árvore.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            Árvores de Processos (Tipos de Processos da Área)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Definição dos fluxos oficiais e rascunhos. Teste qualquer árvore no <strong>Modo Debug</strong> antes de homologá-la para produção.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova Árvore de Processo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {processTypes.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            Nenhuma árvore de processo cadastrada para esta área. Clique em "+ Nova Árvore de Processo" para começar.
          </div>
        ) : (
          processTypes.map((pt) => {
            const isHomologated = pt.status === ProcessTypeStatus.Homologated;
            const isDraft = pt.status === ProcessTypeStatus.Draft;
            return (
              <div
                key={pt.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                <div className="p-5 flex-1 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {pt.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        v{pt.versionNumber}
                      </span>
                      {isHomologated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Homologado
                        </span>
                      ) : isDraft ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Rascunho / Debug
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          Arquivado
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base leading-snug">
                    {pt.name}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2">
                    {pt.description || 'Sem descrição cadastrada.'}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      <strong>{pt.nodesCount}</strong> locais • <strong>{pt.fieldsCount}</strong> campos
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      {pt.targetAudience === ProcessAudience.HeadquartersOnly
                        ? 'Sede'
                        : pt.targetAudience === ProcessAudience.UnitsOnly
                        ? 'Unidades'
                        : 'Geral'}
                    </span>
                  </div>
                </div>

                {/* Ações do Card */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenDebug(pt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    title="Testar no Modo Debug"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Modo Debug
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isDraft && canManage && (
                      <>
                        <button
                          onClick={() => handleOpenBuilder(pt)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Parametrizar Árvore"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleHomologate(pt.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                          title="Homologar para Produção"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Homologar
                        </button>
                      </>
                    )}

                    {isHomologated && canManage && (
                      <button
                        onClick={() => handleCloneVersion(pt)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        title="Criar nova versão a partir desta homologada"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        Nova Versão
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Inicial de Criação de Árvore */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">Nova Árvore de Processo</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <span className="sr-only">Fechar</span>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Código do Processo *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ex: PROC-JUR-CONTRATOS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome da Árvore *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Análise de Contrato Comercial"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Público-Alvo com Permissão de Abertura *</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={ProcessAudience.All}>Ambos (Sede e Unidades)</option>
                  <option value={ProcessAudience.HeadquartersOnly}>Exclusivo para Sede</option>
                  <option value={ProcessAudience.UnitsOnly}>Exclusivo para Unidades / Filiais</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ponto de Partida / Confecção Inicial</label>
                <select
                  value={startNodeId}
                  onChange={(e) => setStartNodeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione o local de confecção...</option>
                  {availableNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Finalidade deste processo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Rascunho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Construtor da Árvore */}
      {selectedProcessTypeForEdit && (
        <ProcessTreeBuilderModal
          processType={selectedProcessTypeForEdit}
          availableNodes={availableNodes}
          availableFields={availableFields}
          onClose={() => setSelectedProcessTypeForEdit(null)}
          onSaved={() => {
            setSelectedProcessTypeForEdit(null);
            onRefresh();
          }}
        />
      )}

      {/* Modal Simulador / Modo Debug */}
      {selectedProcessTypeForDebug && (
        <ProcessSimulatorModal
          processType={selectedProcessTypeForDebug}
          onClose={() => setSelectedProcessTypeForDebug(null)}
          onHomologate={
            selectedProcessTypeForDebug.status === ProcessTypeStatus.Draft
              ? () => handleHomologate(selectedProcessTypeForDebug.id)
              : undefined
          }
        />
      )}
    </div>
  );
};
