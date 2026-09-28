import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  FileText,
  Paperclip,
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  AlertCircle,
  Upload,
  Trash2,
  File,
  FileCheck,
  Building,
  User,
  Calendar,
  HelpCircle,
} from 'lucide-react';
import * as workflowsApi from '../api';
import type {
  ProcessInstance,
  ProcessType,
} from '../types';
import { FieldType, ProcessStatus } from '../types';
import { evaluateFieldConditions } from '../utils/evaluateFieldConditions';

interface LocalAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export const ProcessConfectionPage: React.FC = () => {
  const { id: processId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [protocoling, setProtocoling] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [processInstance, setProcessInstance] = useState<ProcessInstance | null>(null);
  const [processType, setProcessType] = useState<ProcessType | null>(null);

  // Estados dos formulários
  const [title, setTitle] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [protocolObservations, setProtocolObservations] = useState('');

  // 1. Carregar dados do Processo e da Árvore
  const loadData = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);

    try {
      const instance = await workflowsApi.getProcessById(processId);
      setProcessInstance(instance);
      setTitle(instance.title || '');

      // Preencher valores já existentes
      const initialMap: Record<string, string> = {};
      if (instance.fieldValues) {
        instance.fieldValues.forEach((fv) => {
          if (fv.value !== undefined && fv.value !== null) {
            initialMap[fv.fieldDefinitionId] = fv.value;
          }
        });
      }
      setFormValues(initialMap);

      // Carregar a árvore de processo completa
      const tree = await workflowsApi.getProcessTypeById(instance.processTypeId);
      setProcessType(tree);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados do processo para confecção.');
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar campos do nodo de confecção / partida
  const confectionFields = useMemo(() => {
    if (!processType) return [];
    const startNodeId = processType.startNodeId;
    return processType.fields
      .filter((f) => !f.processNodeId || f.processNodeId === startNodeId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [processType]);

  // Avaliação reativa de regras condicionais
  const evaluated = useMemo(() => {
    if (!processType) {
      return {
        hiddenFieldIds: new Set<string>(),
        disabledFieldIds: new Set<string>(),
        requiredFieldIds: new Set<string>(),
        optionalFieldIds: new Set<string>(),
        setFieldValues: {},
        clearedFieldIds: new Set<string>(),
      };
    }

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

  // Atualização de campos
  const handleFieldChange = (fieldId: string, val: string) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: val }));
    // Limpa erro de validação do campo ao digitar
    if (validationErrors[fieldId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  // Salvar Rascunho
  const handleSaveDraft = async (silent = false) => {
    if (!processId) return;
    if (!silent) setSavingDraft(true);
    setError(null);

    try {
      const updated = await workflowsApi.updateProcessDraft(processId, {
        title: title.trim() || undefined,
        fieldValues: formValues,
      });
      setProcessInstance(updated);
      const now = new Date();
      setLastSavedTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      if (!silent) {
        setError(err?.message || 'Erro ao salvar rascunho.');
      }
    } finally {
      if (!silent) setSavingDraft(false);
    }
  };

  // Validação dos Campos da Tela 1 antes de avançar para a Tela 2
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    confectionFields.forEach((field) => {
      const isHidden = evaluated.hiddenFieldIds.has(field.fieldDefinitionId);
      if (isHidden) return;

      const isRequired = field.isRequired || evaluated.requiredFieldIds.has(field.fieldDefinitionId);
      if (isRequired) {
        const val = formValues[field.fieldDefinitionId];
        if (!val || val.trim() === '') {
          errors[field.fieldDefinitionId] = `O campo "${field.customLabel || field.name}" é obrigatório.`;
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextFromStep1 = async () => {
    if (!validateStep1()) {
      setError('Por favor, preencha todos os campos obrigatórios antes de prosseguir.');
      return;
    }
    await handleSaveDraft(true);
    setError(null);
    setStep(2);
  };

  const handleNextFromStep2 = async () => {
    await handleSaveDraft(true);
    setStep(3);
  };

  // Upload de Anexo Local / Simulado
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: LocalAttachment[] = Array.from(files).map((f) => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
      uploadedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Protocolar Processo
  const handleProtocol = async () => {
    if (!processId) return;
    setProtocoling(true);
    setError(null);

    try {
      await workflowsApi.protocolProcess(processId, {
        title: title.trim() || undefined,
        fieldValues: formValues,
        observations: protocolObservations.trim() || undefined,
      });

      // Redireciona de volta para a central de workflows na aba Minhas Solicitações
      navigate('/app/workflows');
    } catch (err: any) {
      setError(err?.message || 'Erro ao protocolar o processo.');
      setProtocoling(false);
    }
  };

  // Formatar tamanho de arquivo
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Carregando formulário do processo...</p>
      </div>
    );
  }

  if (!processInstance || !processType) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4 max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Processo não encontrado</h2>
        <p className="text-xs text-slate-500">
          Não foi possível encontrar as informações deste processo ou da árvore correspondente.
        </p>
        <Link
          to="/app/workflows"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a Central de Processos
        </Link>
      </div>
    );
  }

  const isDraft = processInstance.status === ProcessStatus.Draft;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Barra de Navegação Superior e Ações de Cabeçalho */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/workflows')}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Voltar para a central"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                {processInstance.processNumber.startsWith('#') ? processInstance.processNumber : `Processo #${processInstance.processNumber}`}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                • {processInstance.areaName}
              </span>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                {isDraft ? 'Rascunho em Confecção' : 'Processo em Tramitação'}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-800 mt-1 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              {processType.name} (v{processType.versionNumber})
            </h1>
          </div>
        </div>

        {/* Botões de Ação do Topo */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {lastSavedTime && (
            <span className="text-[11px] text-emerald-600 font-medium hidden sm:inline">
              Rascunho salvo às {lastSavedTime}
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSaveDraft()}
            disabled={savingDraft || protocoling}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-500" />
            {savingDraft ? 'Salvando...' : 'Salvar Rascunho'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/workflows')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Stepper de 3 Etapas */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          {/* Etapa 1 */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-xl transition-all ${
              step === 1
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold'
                : 'text-slate-500 hover:bg-slate-50 font-medium'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              1
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold">1. Confecção</div>
              <div className="text-[10px] text-slate-400">Campos do processo</div>
            </div>
          </button>

          {/* Etapa 2 */}
          <button
            type="button"
            onClick={() => {
              if (validateStep1()) {
                setStep(2);
              }
            }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-xl transition-all ${
              step === 2
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold'
                : 'text-slate-500 hover:bg-slate-50 font-medium'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold">2. Anexos</div>
              <div className="text-[10px] text-slate-400">Documentos e arquivos</div>
            </div>
          </button>

          {/* Etapa 3 */}
          <button
            type="button"
            onClick={() => {
              if (validateStep1()) {
                setStep(3);
              }
            }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-xl transition-all ${
              step === 3
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold'
                : 'text-slate-500 hover:bg-slate-50 font-medium'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold">3. Revisão & Protocolo</div>
              <div className="text-[10px] text-slate-400">Conferência e envio</div>
            </div>
          </button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TELA 1: DADOS DO PROCESSO & CAMPOS DO NODO DE CONFECÇÃO                    */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Etapa 1: Formulário de Confecção ({processType.startNodeName || 'Nodo Inicial'})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Preencha os dados necessários para o atendimento da sua solicitação. Os campos com asterisco (*) são de preenchimento obrigatório.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Título / Assunto do Processo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assunto / Título do Processo (Opcional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`ex: Solicitação de Admissão - ${processInstance.processNumber}`}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Se não preenchido, o sistema utilizará o nome padrão do serviço com o número de protocolo.
              </p>
            </div>

            {/* Renderização Dinâmica dos Campos do Nó */}
            {confectionFields.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                Este fluxo de processo não possui campos adicionais configurados no nodo de confecção.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                {confectionFields.map((field) => {
                  const isHidden = evaluated.hiddenFieldIds.has(field.fieldDefinitionId);
                  const isDisabled = evaluated.disabledFieldIds.has(field.fieldDefinitionId);
                  const isRequired = field.isRequired || evaluated.requiredFieldIds.has(field.fieldDefinitionId);
                  const fieldError = validationErrors[field.fieldDefinitionId];

                  if (isHidden) return null;

                  const isFullWidth =
                    field.type === FieldType.TextArea ||
                    confectionFields.length === 1;

                  return (
                    <div
                      key={field.id}
                      className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}
                    >
                      <label className="block text-xs font-semibold text-slate-700">
                        {field.customLabel || field.name}
                        {isRequired && <span className="text-rose-500 ml-0.5 font-bold">*</span>}
                      </label>

                      {field.helpText && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                          {field.helpText}
                        </p>
                      )}

                      {/* Renderização de acordo com o Tipo do Campo */}
                      {field.type === FieldType.Select ? (
                        <select
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          className={`w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors ${
                            fieldError ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300'
                          }`}
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
                          rows={3}
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          placeholder={field.placeholder || 'Digite as informações detalhadas...'}
                          className={`w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors ${
                            fieldError ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300'
                          }`}
                        />
                      ) : field.type === FieldType.Date ? (
                        <input
                          type="date"
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          className={`w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors ${
                            fieldError ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300'
                          }`}
                        />
                      ) : (
                        <input
                          type={field.type === FieldType.Number || field.type === FieldType.Currency ? 'number' : 'text'}
                          step={field.type === FieldType.Currency ? '0.01' : undefined}
                          disabled={isDisabled}
                          value={formValues[field.fieldDefinitionId] || ''}
                          onChange={(e) => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          placeholder={field.placeholder || (field.type === FieldType.Currency ? 'R$ 0,00' : 'Preencha...')}
                          className={`w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors ${
                            fieldError ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300'
                          }`}
                        />
                      )}

                      {fieldError && (
                        <p className="text-[11px] text-rose-600 font-semibold mt-1">
                          {fieldError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rodapé da Tela 1 */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSaveDraft()}
              disabled={savingDraft}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm"
            >
              Salvar Rascunho
            </button>

            <button
              type="button"
              onClick={handleNextFromStep1}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
            >
              <span>Seguinte (Anexos)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TELA 2: DOCUMENTOS E ANEXOS DO PROCESSO                                   */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-indigo-600" />
              Etapa 2: Documentos e Anexos do Processo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adicione documentos comprobatórios, notas fiscais, contratos, imagens ou relatórios que fundamentam a sua solicitação.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Área de Upload (Drag & Drop) */}
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/30 rounded-2xl p-8 text-center transition-colors cursor-pointer relative">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">
                    Clique para selecionar ou arraste os arquivos aqui
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Suporta arquivos PDF, DOCX, XLSX, PNG, JPG (até 25MB cada)
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de Arquivos Anexados */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Arquivos Anexados ({attachments.length})
                </h3>
              </div>

              {attachments.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  Nenhum arquivo anexado até o momento. (Opcional)
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <File className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {file.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatFileSize(file.size)} • Anexado às {file.uploadedAt}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(file.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remover anexo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rodapé da Tela 2 */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar (Campos)</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveDraft()}
                disabled={savingDraft}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm"
              >
                Salvar Rascunho
              </button>

              <button
                type="button"
                onClick={handleNextFromStep2}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
              >
                <span>Seguinte (Revisão)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TELA 3: REVISÃO GERAL & PROTOCOLO FORMAL                                  */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-6">
          <div className="p-6 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-indigo-600" />
              Etapa 3: Revisão e Protocolo do Processo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Revise todos os dados e anexos informados antes de concluir o envio formal para a esteira da área.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Card 1: Identificação Geral */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Dados Gerais da Solicitação
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Número do Protocolo:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {processInstance.processNumber.startsWith('#') ? processInstance.processNumber : `Processo #${processInstance.processNumber}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Área de Destino:</span>
                  <span className="font-semibold text-slate-800">{processInstance.areaName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Serviço / Árvore:</span>
                  <span className="font-semibold text-slate-800">{processType.name} (v{processType.versionNumber})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Solicitante:</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {processInstance.createdByUserName || 'Você'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Unidade / Sede:</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    {processInstance.originUnitName || 'Sede da Empresa'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Data de Início:</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(processInstance.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {title && (
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block text-[11px]">Assunto / Título:</span>
                  <span className="font-semibold text-slate-800">{title}</span>
                </div>
              )}
            </div>

            {/* Card 2: Campos Preenchidos */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Campos Preenchidos na Confecção
                </h3>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Editar Campos
                </button>
              </div>

              {confectionFields.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum campo específico configurado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {confectionFields.map((field) => {
                    const isHidden = evaluated.hiddenFieldIds.has(field.fieldDefinitionId);
                    if (isHidden) return null;

                    const val = formValues[field.fieldDefinitionId];
                    return (
                      <div
                        key={field.id}
                        className="bg-white p-3 rounded-xl border border-slate-200/70"
                      >
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          {field.customLabel || field.name}
                        </span>
                        <span className="text-xs font-medium text-slate-800 mt-0.5 block break-words">
                          {val ? (
                            field.type === FieldType.Currency ? `R$ ${val}` : val
                          ) : (
                            <span className="text-slate-400 italic">Não informado</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card 3: Documentos Anexados */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Documentos Anexados ({attachments.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Gerenciar Anexos
                </button>
              </div>

              {attachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum anexo adicionado.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center gap-2.5"
                    >
                      <File className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observações Iniciais de Protocolo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Observações / Despacho Inicial ao Protocolar (Opcional)
              </label>
              <textarea
                rows={3}
                value={protocolObservations}
                onChange={(e) => setProtocolObservations(e.target.value)}
                placeholder="Insira alguma informação adicional ou consideração para os analistas da área..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Rodapé da Tela 3 */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar (Anexos)</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveDraft()}
                disabled={savingDraft || protocoling}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm"
              >
                Salvar Rascunho
              </button>

              <button
                type="button"
                onClick={handleProtocol}
                disabled={protocoling}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{protocoling ? 'Protocolando...' : 'Protocolar Processo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
