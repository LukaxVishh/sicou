import React, { useState, useMemo } from 'react';
import { X, Play, ArrowRight, RotateCcw, CornerUpLeft, CheckCircle2, Layers, Info } from 'lucide-react';
import type { ProcessType } from '../types';
import { FieldType } from '../types';
import { evaluateFieldConditions } from '../utils/evaluateFieldConditions';

interface ProcessSimulatorModalProps {
  processType: ProcessType;
  onClose: () => void;
  onHomologate?: () => void;
}

export const ProcessSimulatorModal: React.FC<ProcessSimulatorModalProps> = ({
  processType,
  onClose,
  onHomologate,
}) => {
  // Estado da simulação
  const [currentNodeId, setCurrentNodeId] = useState<string>(
    processType.startNodeId || processType.nodes[0]?.processNodeId || ''
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [simulationLog, setSimulationLog] = useState<string[]>([
    `Simulação iniciada. Local atual: ${processType.startNodeName || 'Ponto de Partida'}.`,
  ]);

  // Nodo atual do simulador
  const currentNode = useMemo(() => {
    return processType.nodes.find((n) => n.processNodeId === currentNodeId);
  }, [processType, currentNodeId]);

  // Transições permitidas a partir do nodo atual
  const availableAdvanceTransitions = useMemo(() => {
    return processType.transitions.filter((t) => t.fromNodeId === currentNodeId && t.allowAdvance);
  }, [processType, currentNodeId]);

  const availableReturnTransitions = useMemo(() => {
    return processType.transitions.filter((t) => t.toNodeId === currentNodeId && t.allowReturn);
  }, [processType, currentNodeId]);

  // Campos associados a este nodo ou ao processo todo
  const nodeFields = useMemo(() => {
    return processType.fields.filter(
      (f) => !f.processNodeId || f.processNodeId === currentNodeId
    );
  }, [processType, currentNodeId]);

  // Avaliação reativa das regras condicionais entre os campos
  const evaluated = useMemo(() => {
    // Unir todas as regras dos campos deste processo
    const rulesArray: any[] = [];
    processType.fields.forEach((f) => {
      if (f.conditionsJson) {
        try {
          const parsed = JSON.parse(f.conditionsJson);
          if (Array.isArray(parsed)) rulesArray.push(...parsed);
        } catch {}
      }
    });

    return evaluateFieldConditions(JSON.stringify(rulesArray), formValues);
  }, [processType, formValues]);

  const handleFieldChange = (fieldId: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleAdvance = (targetNodeId: string, targetName: string) => {
    setCurrentNodeId(targetNodeId);
    setSimulationLog((prev) => [
      `Avançou para o local: "${targetName}".`,
      ...prev,
    ]);
  };

  const handleReturn = (targetNodeId: string, targetName: string) => {
    setCurrentNodeId(targetNodeId);
    setSimulationLog((prev) => [
      `Devolveu para o local: "${targetName}".`,
      ...prev,
    ]);
  };

  const handleRestart = () => {
    if (!processType.startNodeId) return;
    setCurrentNodeId(processType.startNodeId);
    setSimulationLog((prev) => [
      `Processo reiniciado para o Ponto de Partida: "${processType.startNodeName}".`,
      ...prev,
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Top Header do Modo Debug */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Play className="w-5 h-5 fill-current" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">
                  Modo Debug / Simulador em Tempo Real
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {processType.code} v{processType.versionNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Teste interativo de preenchimento, regras condicionais e fluxo de tramitação sem persistir registros.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso / Nodos */}
        <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 overflow-x-auto flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase shrink-0 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Locais:
          </span>
          {processType.nodes.map((n, idx) => {
            const isCurrent = n.processNodeId === currentNodeId;
            return (
              <React.Fragment key={n.id}>
                <button
                  onClick={() => {
                    setCurrentNodeId(n.processNodeId);
                    setSimulationLog((prev) => [`Saltou diretamente para "${n.name}".`, ...prev]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span className="font-mono opacity-60">#{idx + 1}</span>
                  {n.name}
                </button>
                {idx < processType.nodes.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Corpo Principal: Formulário + Painel de Ações */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna 1 & 2: O Formulário Renderizado */}
          <div className="md:col-span-2 space-y-5">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                Local Atual de Processo
              </span>
              <h4 className="text-lg font-bold text-slate-800 mt-0.5">
                {currentNode?.name || 'Local não selecionado'}
              </h4>
              {currentNode?.instructions && (
                <p className="text-xs text-slate-600 mt-1 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  {currentNode.instructions}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Formulário do Local ({nodeFields.length} campos configurados)
              </h5>

              {nodeFields.length === 0 ? (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Nenhum campo associado a este local de processo.
                </div>
              ) : (
                nodeFields.map((field) => {
                  const isHidden = evaluated.hiddenFieldIds.has(field.fieldDefinitionId);
                  const isDisabled = evaluated.disabledFieldIds.has(field.fieldDefinitionId);
                  const isRequired = field.isRequired || evaluated.requiredFieldIds.has(field.fieldDefinitionId);

                  if (isHidden) {
                    return (
                      <div
                        key={field.id}
                        className="p-2.5 rounded-lg bg-amber-50/50 border border-dashed border-amber-200 text-xs text-amber-700 flex items-center justify-between"
                      >
                        <span>Campo <strong>{field.customLabel || field.name}</strong> está ocultado por regra condicional.</span>
                        <span className="font-mono text-[10px] text-amber-500">Hide Rule</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={field.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isDisabled
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          {field.customLabel || field.name}
                          {isRequired && <span className="text-rose-500">*</span>}
                        </label>
                        <span className="text-[10px] font-mono text-slate-400">
                          {field.code}
                        </span>
                      </div>

                      {field.helpText && (
                        <p className="text-[11px] text-slate-500 mb-2">{field.helpText}</p>
                      )}

                      {/* Renderizador de Inputs */}
                      {field.type === FieldType.Select ? (
                        <select
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Selecione uma opção...</option>
                          {field.globalOptionsJson ? (
                            (() => {
                              try {
                                const opts = JSON.parse(field.globalOptionsJson);
                                return Array.isArray(opts)
                                  ? opts.map((opt: string) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))
                                  : null;
                              } catch {
                                return null;
                              }
                            })()
                          ) : (
                            <>
                              <option value="Sim">Sim</option>
                              <option value="Não">Não</option>
                            </>
                          )}
                        </select>
                      ) : field.type === FieldType.TextArea ? (
                        <textarea
                          rows={2}
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          placeholder={field.placeholder || 'Digite o texto...'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : field.type === FieldType.Boolean ? (
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={field.fieldDefinitionId}
                              value="Sim"
                              checked={formValues[field.fieldDefinitionId] === 'Sim'}
                              onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                              disabled={isDisabled}
                            />
                            Sim
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={field.fieldDefinitionId}
                              value="Não"
                              checked={formValues[field.fieldDefinitionId] === 'Não'}
                              onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                              disabled={isDisabled}
                            />
                            Não
                          </label>
                        </div>
                      ) : (
                        <input
                          type={field.type === FieldType.Number || field.type === FieldType.Currency ? 'number' : 'text'}
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          placeholder={field.placeholder || 'Preencha o campo...'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      )}

                      {isDisabled && (
                        <span className="text-[10px] text-slate-400 block mt-1 italic">
                          Campo desabilitado por regra de condição.
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna 3: Ações de Tramitação Simulada e Log */}
          <div className="space-y-5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Ações de Tramitação Permitidas
              </h5>

              {/* Botões de Avanço */}
              <div className="space-y-2">
                {availableAdvanceTransitions.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                    Nenhum avanço configurado para este local.
                  </div>
                ) : (
                  availableAdvanceTransitions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleAdvance(t.toNodeId, t.toNodeName)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                    >
                      <span>Avançar para: {t.toNodeName}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ))
                )}
              </div>

              {/* Botão de Devolução */}
              {availableReturnTransitions.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  {availableReturnTransitions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleReturn(t.fromNodeId, t.fromNodeName)}
                      className="w-full flex items-center justify-between px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium rounded-lg transition-all"
                    >
                      <span>Devolver para: {t.fromNodeName}</span>
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Botão de Reinício */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={handleRestart}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reiniciar para Confecção
                </button>
              </div>
            </div>

            {/* Log de Auditoria do Simulador */}
            <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Histórico da Simulação
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs font-mono text-slate-300">
                {simulationLog.map((log, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-indigo-400 shrink-0">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com botão de Homologação */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            O fluxo funcionou como esperado? Você pode homologá-lo agora para torná-lo oficial.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium"
            >
              Fechar Simulador
            </button>
            {onHomologate && (
              <button
                onClick={onHomologate}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Homologar Árvore Agora
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
