import React, { useState } from 'react';
import { X, Trash2, ArrowRight, Check, AlertCircle, Sparkles, MoveRight } from 'lucide-react';
import type {
  ProcessType,
  ProcessNode,
  FieldDefinition,
  UpdateProcessTypePayload,
} from '../types';
import { ProcessAudience } from '../types';
import * as workflowsApi from '../api';

interface ProcessTreeBuilderModalProps {
  processType: ProcessType;
  availableNodes: ProcessNode[];
  availableFields: FieldDefinition[];
  onClose: () => void;
  onSaved: () => void;
}

export const ProcessTreeBuilderModal: React.FC<ProcessTreeBuilderModalProps> = ({
  processType,
  availableNodes,
  availableFields,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'nodes' | 'fields' | 'transitions'>('nodes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States
  const [name, setName] = useState(processType.name);
  const [description, setDescription] = useState(processType.description || '');
  const [targetAudience, setTargetAudience] = useState<number>(processType.targetAudience);
  const [startNodeId, setStartNodeId] = useState<string>(processType.startNodeId || '');

  // Nodos adicionados à árvore
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(
    processType.nodes.map((n) => n.processNodeId)
  );

  // Campos vinculados à árvore
  const [fieldsState, setFieldsState] = useState<
    {
      fieldDefinitionId: string;
      processNodeId?: string;
      isRequired: boolean;
      displayOrder: number;
      customLabel?: string;
      helpText?: string;
      conditionsJson?: string;
    }[]
  >(
    processType.fields.map((f) => ({
      fieldDefinitionId: f.fieldDefinitionId,
      processNodeId: f.processNodeId,
      isRequired: f.isRequired,
      displayOrder: f.displayOrder,
      customLabel: f.customLabel,
      helpText: f.helpText,
      conditionsJson: f.conditionsJson,
    }))
  );

  // Transições vinculadas à árvore
  const [transitionsState, setTransitionsState] = useState<
    {
      fromNodeId: string;
      toNodeId: string;
      allowAdvance: boolean;
      allowReturn: boolean;
      allowRestart: boolean;
    }[]
  >(
    processType.transitions.map((t) => ({
      fromNodeId: t.fromNodeId,
      toNodeId: t.toNodeId,
      allowAdvance: t.allowAdvance,
      allowReturn: t.allowReturn,
      allowRestart: t.allowRestart,
    }))
  );

  // Adicionar nodo à árvore
  const handleAddNode = (nodeId: string) => {
    if (!nodeId || selectedNodeIds.includes(nodeId)) return;
    const newNodes = [...selectedNodeIds, nodeId];
    setSelectedNodeIds(newNodes);
    if (!startNodeId) setStartNodeId(nodeId);
  };

  const handleRemoveNode = (nodeId: string) => {
    setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
    if (startNodeId === nodeId) {
      setStartNodeId('');
    }
    // Remove transições associadas
    setTransitionsState((prev) =>
      prev.filter((t) => t.fromNodeId !== nodeId && t.toNodeId !== nodeId)
    );
  };

  // Adicionar campo ao processo
  const handleAddField = (fieldDefId: string) => {
    if (!fieldDefId) return;
    setFieldsState((prev) => [
      ...prev,
      {
        fieldDefinitionId: fieldDefId,
        processNodeId: selectedNodeIds[0] || undefined,
        isRequired: false,
        displayOrder: prev.length + 1,
      },
    ]);
  };

  const handleRemoveField = (index: number) => {
    setFieldsState((prev) => prev.filter((_, i) => i !== index));
  };

  // Adicionar transição
  const handleAddTransition = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const exists = transitionsState.some((t) => t.fromNodeId === fromId && t.toNodeId === toId);
    if (exists) return;

    setTransitionsState((prev) => [
      ...prev,
      {
        fromNodeId: fromId,
        toNodeId: toId,
        allowAdvance: true,
        allowReturn: true,
        allowRestart: true,
      },
    ]);
  };

  const handleRemoveTransition = (index: number) => {
    setTransitionsState((prev) => prev.filter((_, i) => i !== index));
  };

  // Salvar árvore
  const handleSave = async () => {
    setError(null);
    setLoading(true);

    try {
      const payload: UpdateProcessTypePayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        targetAudience: targetAudience as any,
        startNodeId: startNodeId || undefined,
        nodes: selectedNodeIds.map((id, index) => ({
          processNodeId: id,
          order: index + 1,
        })),
        fields: fieldsState.map((f, index) => ({
          fieldDefinitionId: f.fieldDefinitionId,
          processNodeId: f.processNodeId || undefined,
          isRequired: f.isRequired,
          displayOrder: index + 1,
          customLabel: f.customLabel?.trim() || undefined,
          helpText: f.helpText?.trim() || undefined,
          conditionsJson: f.conditionsJson || undefined,
        })),
        transitions: transitionsState,
      };

      await workflowsApi.updateProcessType(processType.id, payload);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar parametrização da árvore.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-800">
                Parametrizador de Árvore de Processo
              </h3>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {processType.code} (v{processType.versionNumber})
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Configure os locais da árvore, vincule campos com regras contextuais e defina as transições de fluxo.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('nodes')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'nodes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Locais do Processo ({selectedNodeIds.length})
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'fields'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Campos & Regras Condicionais ({fieldsState.length})
          </button>
          <button
            onClick={() => setActiveTab('transitions')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'transitions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Transições / Fluxo ({transitionsState.length})
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'info'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            4. Dados Gerais & Audiência
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ABA 1: LOCAIS */}
          {activeTab === 'nodes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Adicionar Local do Catálogo nesta Árvore
                </span>
                <select
                  onChange={(e) => {
                    handleAddNode(e.target.value);
                    e.target.value = '';
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">+ Selecionar Local para Incluir...</option>
                  {availableNodes
                    .filter((n) => !selectedNodeIds.includes(n.id))
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-3">
                {selectedNodeIds.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Nenhum local adicionado nesta árvore. Adicione o Ponto de Partida e as etapas seguintes acima.
                  </div>
                ) : (
                  selectedNodeIds.map((nodeId, idx) => {
                    const node = availableNodes.find((n) => n.id === nodeId);
                    const isStart = startNodeId === nodeId;
                    return (
                      <div
                        key={nodeId}
                        className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                          isStart
                            ? 'bg-emerald-50/60 border-emerald-200 ring-1 ring-emerald-300'
                            : 'bg-white border-slate-200 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-mono font-bold text-slate-600">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-800 text-sm">
                                {node?.name || nodeId}
                              </h4>
                              {isStart && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-600 text-white">
                                  Ponto de Partida / Confecção
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 font-mono">
                              {node?.code} • {node?.description || 'Sem descrição'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isStart && (
                            <button
                              onClick={() => setStartNodeId(nodeId)}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                            >
                              Definir como Ponto de Partida
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveNode(nodeId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                            title="Remover Local da Árvore"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ABA 2: CAMPOS & REGRAS */}
          {activeTab === 'fields' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Campos Vinculados a este Processo
                  </span>
                  <span className="text-xs text-slate-500">
                    Defina se o campo é obrigatório especificamente neste processo e adicione regras de dependência.
                  </span>
                </div>
                <select
                  onChange={(e) => {
                    handleAddField(e.target.value);
                    e.target.value = '';
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">+ Adicionar Campo do Catálogo...</option>
                  {availableFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {fieldsState.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Nenhum campo vinculado a este processo. Selecione campos do catálogo acima.
                  </div>
                ) : (
                  fieldsState.map((fieldState, idx) => {
                    const fieldDef = availableFields.find((f) => f.id === fieldState.fieldDefinitionId);
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center font-mono">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800 text-sm">
                              {fieldDef?.name}
                            </span>
                            <span className="text-xs font-mono text-slate-400">({fieldDef?.code})</span>
                          </div>
                          <button
                            onClick={() => handleRemoveField(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Local de Exibição
                            </label>
                            <select
                              value={fieldState.processNodeId || ''}
                              onChange={(e) => {
                                const val = e.target.value || undefined;
                                setFieldsState((prev) => {
                                  const copy = [...prev];
                                  copy[idx].processNodeId = val;
                                  return copy;
                                });
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="">Todos os Locais</option>
                              {selectedNodeIds.map((nId) => {
                                const n = availableNodes.find((x) => x.id === nId);
                                return (
                                  <option key={nId} value={nId}>
                                    {n?.name || nId}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Rótulo Personalizado (Opcional)
                            </label>
                            <input
                              type="text"
                              value={fieldState.customLabel || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldsState((prev) => {
                                  const copy = [...prev];
                                  copy[idx].customLabel = val;
                                  return copy;
                                });
                              }}
                              placeholder={fieldDef?.name}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>

                          <div className="flex items-center pt-5">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fieldState.isRequired}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setFieldsState((prev) => {
                                    const copy = [...prev];
                                    copy[idx].isRequired = val;
                                    return copy;
                                  });
                                }}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                              />
                              Obrigatório neste Processo
                            </label>
                          </div>
                        </div>

                        {/* Editor de Regras Condicionais Simples */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Regra Condicional (JSON)
                          </div>
                          <input
                            type="text"
                            value={fieldState.conditionsJson || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFieldsState((prev) => {
                                const copy = [...prev];
                                copy[idx].conditionsJson = val;
                                return copy;
                              });
                            }}
                            placeholder='[{"sourceFieldId":"...","operator":"Equals","expectedValue":"Sim","action":"Show","targetFieldIds":["..."]}]'
                            className="w-full px-2.5 py-1 border border-slate-300 rounded text-[11px] font-mono"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ABA 3: TRANSIÇÕES */}
          {activeTab === 'transitions' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Adicionar Ligação de Fluxo entre Locais
                </span>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <select
                    id="fromNodeSelect"
                    className="w-full sm:w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Local de Origem...</option>
                    {selectedNodeIds.map((id) => (
                      <option key={id} value={id}>
                        {availableNodes.find((n) => n.id === id)?.name}
                      </option>
                    ))}
                  </select>
                  <MoveRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                  <select
                    id="toNodeSelect"
                    className="w-full sm:w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Local de Destino...</option>
                    {selectedNodeIds.map((id) => (
                      <option key={id} value={id}>
                        {availableNodes.find((n) => n.id === id)?.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const fromSelect = document.getElementById('fromNodeSelect') as HTMLSelectElement;
                      const toSelect = document.getElementById('toNodeSelect') as HTMLSelectElement;
                      if (fromSelect?.value && toSelect?.value) {
                        handleAddTransition(fromSelect.value, toSelect.value);
                      }
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shrink-0"
                  >
                    Conectar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {transitionsState.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Nenhuma ligação configurada. Conecte os locais para permitir avanço e devolução.
                  </div>
                ) : (
                  transitionsState.map((t, idx) => {
                    const fromNode = availableNodes.find((n) => n.id === t.fromNodeId);
                    const toNode = availableNodes.find((n) => n.id === t.toNodeId);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-800 text-xs">
                            {fromNode?.name || t.fromNodeId}
                          </span>
                          <ArrowRight className="w-4 h-4 text-indigo-500" />
                          <span className="font-semibold text-slate-800 text-xs">
                            {toNode?.name || t.toNodeId}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={t.allowAdvance}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setTransitionsState((prev) => {
                                  const copy = [...prev];
                                  copy[idx].allowAdvance = val;
                                  return copy;
                                });
                              }}
                              className="w-3.5 h-3.5 text-indigo-600 rounded"
                            />
                            Avançar
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={t.allowReturn}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setTransitionsState((prev) => {
                                  const copy = [...prev];
                                  copy[idx].allowReturn = val;
                                  return copy;
                                });
                              }}
                              className="w-3.5 h-3.5 text-indigo-600 rounded"
                            />
                            Devolver
                          </label>
                          <button
                            onClick={() => handleRemoveTransition(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ABA 4: INFORMAÇÕES GERAIS */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome do Processo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Público-Alvo com Permissão de Abertura *
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value={ProcessAudience.All}>Ambos (Sede e Unidades)</option>
                  <option value={ProcessAudience.HeadquartersOnly}>Exclusivo para Sede</option>
                  <option value={ProcessAudience.UnitsOnly}>Exclusivo para Unidades / Filiais</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Descrição do Processo
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};
