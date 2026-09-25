import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, AlertCircle, FileText } from 'lucide-react';
import type { ProcessTypeSummary, ProcessType } from '../types';
import { FieldType } from '../types';
import * as workflowsApi from '../api';
import { evaluateFieldConditions } from '../utils/evaluateFieldConditions';

interface OpenProcessModalProps {
  onClose: () => void;
  onCreated: (newProcessId: string) => void;
}

export const OpenProcessModal: React.FC<OpenProcessModalProps> = ({
  onClose,
  onCreated,
}) => {
  const [availableTypes, setAvailableTypes] = useState<ProcessTypeSummary[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [fullProcessType, setFullProcessType] = useState<ProcessType | null>(null);

  const [title, setTitle] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAvailable() {
      setTypesLoading(true);
      try {
        const data = await workflowsApi.getAvailableProcessTypes();
        setAvailableTypes(data);
        if (data.length > 0) {
          setSelectedTypeId(data[0].id);
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar tipos de processos disponíveis.');
      } finally {
        setTypesLoading(false);
      }
    }
    loadAvailable();
  }, []);

  useEffect(() => {
    async function loadTreeDetails() {
      if (!selectedTypeId) {
        setFullProcessType(null);
        return;
      }
      try {
        const full = await workflowsApi.getProcessTypeById(selectedTypeId);
        setFullProcessType(full);
        setFormValues({});
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar formulário da árvore.');
      }
    }
    loadTreeDetails();
  }, [selectedTypeId]);

  // Filtrar campos do ponto de partida / confecção
  const startFields = useMemo(() => {
    if (!fullProcessType) return [];
    return fullProcessType.fields.filter(
      (f) => !f.processNodeId || f.processNodeId === fullProcessType.startNodeId
    );
  }, [fullProcessType]);

  // Avaliação reativa de regras condicionais
  const evaluated = useMemo(() => {
    if (!fullProcessType) return { hiddenFieldIds: new Set<string>(), disabledFieldIds: new Set<string>(), requiredFieldIds: new Set<string>() };

    const rulesArray: any[] = [];
    fullProcessType.fields.forEach((f) => {
      if (f.conditionsJson) {
        try {
          const parsed = JSON.parse(f.conditionsJson);
          if (Array.isArray(parsed)) rulesArray.push(...parsed);
        } catch {}
      }
    });

    return evaluateFieldConditions(JSON.stringify(rulesArray), formValues);
  }, [fullProcessType, formValues]);

  const handleFieldChange = (fieldId: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeId) return;
    setError(null);
    setLoading(true);

    try {
      const created = await workflowsApi.createProcess({
        processTypeId: selectedTypeId,
        title: title.trim() || undefined,
        initialFieldValues: formValues,
      });

      onCreated(created.id);
    } catch (err: any) {
      setError(err?.message || 'Erro ao abrir processo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Abertura de Novo Processo
            </h3>
            <p className="text-xs text-slate-500">
              Selecione o serviço desejado e preencha as informações da etapa de confecção.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tipo de Processo / Serviço Homologado *
            </label>
            {typesLoading ? (
              <div className="text-xs text-slate-400 py-2">Carregando processos disponíveis...</div>
            ) : availableTypes.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                Nenhuma árvore de processo homologada disponível para sua unidade/área no momento.
              </div>
            ) : (
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {availableTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.areaName}] {t.name} ({t.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Assunto / Título Resumido (Opcional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Homologação de Contrato - Fornecedor Alpha"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Campos do Ponto de Confecção */}
          {fullProcessType && (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Formulário do Ponto de Partida: {fullProcessType.startNodeName}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {startFields.length} campos
                </span>
              </div>

              {startFields.length === 0 ? (
                <div className="p-4 bg-slate-50 text-slate-400 rounded-lg text-xs text-center border border-dashed border-slate-200">
                  Este processo não requer campos adicionais para abertura.
                </div>
              ) : (
                startFields.map((field) => {
                  const isHidden = evaluated.hiddenFieldIds.has(field.fieldDefinitionId);
                  const isDisabled = evaluated.disabledFieldIds.has(field.fieldDefinitionId);
                  const isRequired = field.isRequired || evaluated.requiredFieldIds.has(field.fieldDefinitionId);

                  if (isHidden) return null;

                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        {field.customLabel || field.name}
                        {isRequired && <span className="text-rose-500 ml-0.5">*</span>}
                      </label>
                      {field.helpText && (
                        <p className="text-[11px] text-slate-500">{field.helpText}</p>
                      )}

                      {field.type === FieldType.Select ? (
                        <select
                          required={isRequired}
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Selecione...</option>
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
                          required={isRequired}
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          placeholder={field.placeholder || 'Digite...'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <input
                          type={field.type === FieldType.Number || field.type === FieldType.Currency ? 'number' : 'text'}
                          required={isRequired}
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          placeholder={field.placeholder || 'Preencha...'}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || availableTypes.length === 0}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Protocolando...' : 'Protocolar e Abrir Processo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
