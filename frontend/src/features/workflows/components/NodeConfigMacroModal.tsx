import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Layers,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  FileCheck2,
  Info,
  Type,
  AlignLeft,
  Hash,
  DollarSign,
  CreditCard,
  Building,
  Calendar,
  ListFilter,
  CheckSquare,
  ToggleLeft,
  Paperclip,
  Check,
} from 'lucide-react';
import type {
  ProcessNode,
  FieldDefinition,
  FieldConditionRule,
} from '../types';
import { FieldType, ProcessNodeType } from '../types';
import { evaluateFieldConditions } from '../utils/evaluateFieldConditions';

export interface NodeFieldItemConfig {
  fieldDefinitionId: string;
  isRequired: boolean;
  isHidden?: boolean;
  isReadonly?: boolean;
  displayOrder: number;
  customLabel?: string;
  helpText?: string;
  conditionsJson?: string;
}

interface NodeConfigMacroModalProps {
  nodeId: string;
  nodeLabel: string;
  nodeCode: string;
  nodeType: number;
  isStart?: boolean;
  processNodeId?: string;
  instructions?: string;
  fields: NodeFieldItemConfig[];
  availableCatalogNodes: ProcessNode[];
  availableCatalogFields: FieldDefinition[];
  allProcessFields: NodeFieldItemConfig[];
  onClose: () => void;
  onSave: (data: {
    nodeLabel: string;
    nodeCode: string;
    nodeType: number;
    processNodeId?: string;
    instructions?: string;
    fields: NodeFieldItemConfig[];
  }) => void;
}

const FIELD_TYPE_ICONS: Record<number, React.ElementType> = {
  [FieldType.Text]: Type,
  [FieldType.TextArea]: AlignLeft,
  [FieldType.Number]: Hash,
  [FieldType.Currency]: DollarSign,
  [FieldType.Cpf]: CreditCard,
  [FieldType.Cnpj]: Building,
  [FieldType.Date]: Calendar,
  [FieldType.Select]: ListFilter,
  [FieldType.MultiSelect]: CheckSquare,
  [FieldType.Boolean]: ToggleLeft,
  [FieldType.FileAttachment]: Paperclip,
};

const OPERATOR_LABELS: Record<string, string> = {
  Equals: 'Igual a (=)',
  NotEquals: 'Diferente de (≠)',
  Filled: 'Preenchido / Contém valor',
  Empty: 'Vazio / Não preenchido',
  Contains: 'Contém o texto',
  GreaterThan: 'Maior que (>)',
  LessThan: 'Menor que (<)',
  GreaterOrEqual: 'Maior ou igual a (≥)',
  LessOrEqual: 'Menor ou igual a (≤)',
};

const ACTION_LABELS: Record<string, { label: string; badgeColor: string }> = {
  Show: { label: 'Exibir Campo(s)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Hide: { label: 'Ocultar Campo(s)', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
  Require: { label: 'Tornar Obrigatório(s)', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  Optional: { label: 'Tornar Opcional(is)', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  SetValue: { label: 'Preencher Valor Automaticamente', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  ClearValue: { label: 'Limpar / Resetar Valor', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300' },
  Disable: { label: 'Desabilitar (Somente Leitura)', badgeColor: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
  Enable: { label: 'Habilitar para Edição', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

export const NodeConfigMacroModal: React.FC<NodeConfigMacroModalProps> = ({
  nodeLabel: initialNodeLabel,
  nodeCode: initialNodeCode,
  nodeType: initialNodeType,
  isStart,
  processNodeId: initialProcessNodeId,
  instructions: initialInstructions,
  fields: initialFields,
  availableCatalogNodes,
  availableCatalogFields,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'rules' | 'details' | 'simulator'>('fields');

  // Estados dos Dados do Nó
  const [nodeLabel, setNodeLabel] = useState(initialNodeLabel);
  const [nodeCode, setNodeCode] = useState(initialNodeCode);
  const [nodeType, setNodeType] = useState(initialNodeType);
  const [processNodeId, setProcessNodeId] = useState(initialProcessNodeId || '');
  const [instructions, setInstructions] = useState(initialInstructions || '');

  // Lista de Campos Vinculados a este Nó
  const [nodeFields, setNodeFields] = useState<NodeFieldItemConfig[]>(initialFields);

  // Parse de Regras Condicionais Existentes (extraídas dos conditionsJson dos campos)
  const initialRules = useMemo(() => {
    const rules: FieldConditionRule[] = [];
    initialFields.forEach((f) => {
      if (f.conditionsJson) {
        try {
          const parsed = JSON.parse(f.conditionsJson);
          if (Array.isArray(parsed)) {
            parsed.forEach((r, idx) => {
              rules.push({
                id: r.id || `rule_${f.fieldDefinitionId}_${idx}`,
                description: r.description,
                sourceFieldId: r.sourceFieldId,
                operator: r.operator,
                expectedValue: r.expectedValue,
                action: r.action,
                targetValue: r.targetValue,
                targetFieldIds: r.targetFieldIds || [],
              });
            });
          }
        } catch {}
      }
    });
    return rules;
  }, [initialFields]);

  const [rulesList, setRulesList] = useState<FieldConditionRule[]>(initialRules);

  // Form State para Nova Regra
  const [newRuleDescription, setNewRuleDescription] = useState('');
  const [newRuleSourceId, setNewRuleSourceId] = useState('');
  const [newRuleOperator, setNewRuleOperator] = useState<FieldConditionRule['operator']>('Equals');
  const [newRuleExpectedValue, setNewRuleExpectedValue] = useState('');
  const [newRuleAction, setNewRuleAction] = useState<FieldConditionRule['action']>('Show');
  const [newRuleTargetValue, setNewRuleTargetValue] = useState('');
  const [newRuleTargetIds, setNewRuleTargetIds] = useState<string[]>([]);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Estado para Busca / Adição de Campos do Catálogo
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);

  // Estado do Mini Simulador Local
  const [simulatorValues, setSimulatorValues] = useState<Record<string, string>>({});

  // Obter detalhes de um campo do catálogo por ID
  const getFieldDef = (id: string) => availableCatalogFields.find((f) => f.id === id);

  // Opções do campo motivador selecionado (quando for Select, MultiSelect ou Boolean)
  const sourceFieldOptions = useMemo(() => {
    if (!newRuleSourceId) return [];
    const sourceDef = getFieldDef(newRuleSourceId);
    if (!sourceDef) return [];

    if (sourceDef.type === FieldType.Boolean) {
      return ['Sim', 'Não'];
    }

    if (
      (sourceDef.type === FieldType.Select || sourceDef.type === FieldType.MultiSelect) &&
      sourceDef.globalOptionsJson
    ) {
      try {
        const parsed = JSON.parse(sourceDef.globalOptionsJson);
        if (Array.isArray(parsed)) {
          return parsed.map((item) =>
            typeof item === 'string' ? item : item.label || item.value || String(item)
          );
        }
      } catch {}
    }

    return [];
  }, [newRuleSourceId, availableCatalogFields]);

  // Manipular Vinculação de Local do Catálogo
  const handleCatalogNodeChange = (selectedId: string) => {
    setProcessNodeId(selectedId);
    const cat = availableCatalogNodes.find((n) => n.id === selectedId);
    if (cat) {
      setNodeLabel(cat.name);
      setNodeCode(cat.code);
      setNodeType(cat.nodeType);
      if (cat.description && !instructions) {
        setInstructions(cat.description);
      }
    }
  };

  // Adicionar campo ao nó
  const handleAddFieldToNode = (fieldDefId: string) => {
    if (nodeFields.some((f) => f.fieldDefinitionId === fieldDefId)) return;
    setNodeFields((prev) => [
      ...prev,
      {
        fieldDefinitionId: fieldDefId,
        isRequired: false,
        isHidden: false,
        isReadonly: false,
        displayOrder: prev.length + 1,
      },
    ]);
  };

  // Remover campo do nó
  const handleRemoveFieldFromNode = (fieldDefId: string) => {
    setNodeFields((prev) => prev.filter((f) => f.fieldDefinitionId !== fieldDefId));
    // Remove regras que tinham esse campo como origem ou destino
    setRulesList((prev) =>
      prev.filter(
        (r) =>
          r.sourceFieldId !== fieldDefId &&
          !r.targetFieldIds.includes(fieldDefId)
      )
    );
  };

  // Atualizar propriedade do campo no nó
  const handleUpdateNodeField = (
    fieldDefId: string,
    key: keyof NodeFieldItemConfig,
    value: any
  ) => {
    setNodeFields((prev) =>
      prev.map((f) => {
        if (f.fieldDefinitionId === fieldDefId) {
          return { ...f, [key]: value };
        }
        return f;
      })
    );
  };

  // Adicionar Nova Regra Condicional
  const handleAddRule = (e?: React.FormEvent) => {
    if (e?.preventDefault) e.preventDefault();
    setRuleError(null);

    if (!newRuleSourceId) {
      setRuleError('Selecione o campo motivador (gatilho).');
      return;
    }
    if (
      newRuleOperator !== 'Filled' &&
      newRuleOperator !== 'Empty' &&
      newRuleExpectedValue.trim() === ''
    ) {
      setRuleError('Informe o valor esperado para a condição.');
      return;
    }
    if (newRuleTargetIds.length === 0) {
      setRuleError('Selecione pelo menos um campo alvo para a ação.');
      return;
    }
    if (newRuleAction === 'SetValue' && newRuleTargetValue.trim() === '') {
      setRuleError('Informe o valor a ser atribuído no campo alvo.');
      return;
    }

    const sourceDef = getFieldDef(newRuleSourceId);
    const autoDesc =
      newRuleDescription.trim() ||
      `Se ${sourceDef?.name || 'campo'} ${OPERATOR_LABELS[newRuleOperator]} "${newRuleExpectedValue}" ➔ ${
        ACTION_LABELS[newRuleAction].label
      }`;

    const newRule: FieldConditionRule = {
      id: `rule_${Date.now()}`,
      description: autoDesc,
      sourceFieldId: newRuleSourceId,
      operator: newRuleOperator,
      expectedValue:
        newRuleOperator === 'Filled' || newRuleOperator === 'Empty'
          ? undefined
          : newRuleExpectedValue.trim(),
      action: newRuleAction,
      targetValue: newRuleAction === 'SetValue' ? newRuleTargetValue.trim() : undefined,
      targetFieldIds: newRuleTargetIds,
    };

    setRulesList((prev) => [...prev, newRule]);

    // Limpar form
    setNewRuleDescription('');
    setNewRuleExpectedValue('');
    setNewRuleTargetValue('');
    setNewRuleTargetIds([]);
  };

  const handleRemoveRule = (ruleId: string) => {
    setRulesList((prev) => prev.filter((r) => r.id !== ruleId));
  };

  // Obter lista consolidada de regras, incluindo regra em edição caso o usuário clique direto em "Aplicar"
  const getConsolidatedRules = (): FieldConditionRule[] => {
    const list = [...rulesList];

    if (newRuleSourceId && newRuleTargetIds.length > 0) {
      const isOperatorValueless = newRuleOperator === 'Filled' || newRuleOperator === 'Empty';
      if (isOperatorValueless || newRuleExpectedValue.trim() !== '') {
        const sourceDef = getFieldDef(newRuleSourceId);
        const autoDesc =
          newRuleDescription.trim() ||
          `Se ${sourceDef?.name || 'campo'} ${OPERATOR_LABELS[newRuleOperator]} "${newRuleExpectedValue}" ➔ ${
            ACTION_LABELS[newRuleAction].label
          }`;

        const pendingRule: FieldConditionRule = {
          id: `rule_${Date.now()}`,
          description: autoDesc,
          sourceFieldId: newRuleSourceId,
          operator: newRuleOperator,
          expectedValue: isOperatorValueless ? undefined : newRuleExpectedValue.trim(),
          action: newRuleAction,
          targetValue: newRuleAction === 'SetValue' ? newRuleTargetValue.trim() : undefined,
          targetFieldIds: newRuleTargetIds,
        };

        list.push(pendingRule);
      }
    }

    return list;
  };

  // Avaliação do Simulador do Nó
  const evaluatedSimulator = useMemo(() => {
    return evaluateFieldConditions(JSON.stringify(rulesList), simulatorValues);
  }, [rulesList, simulatorValues]);

  // Salvar tudo e fechar
  const handleConfirmSave = () => {
    const allRules = getConsolidatedRules();

    // Distribuir as regras nos campos correspondentes
    const fieldsWithRules = nodeFields.map((nf, idx) => {
      const fieldRules = allRules.filter((r) => r.sourceFieldId === nf.fieldDefinitionId);

      // Se for o primeiro campo do nó, anexa quaisquer regras adicionais para garantir que nada seja perdido
      if (idx === 0) {
        const orphanRules = allRules.filter(
          (r) => !nodeFields.some((f) => f.fieldDefinitionId === r.sourceFieldId)
        );
        fieldRules.push(...orphanRules);
      }

      return {
        ...nf,
        conditionsJson: fieldRules.length > 0 ? JSON.stringify(fieldRules) : undefined,
      };
    });

    onSave({
      nodeLabel: nodeLabel.trim(),
      nodeCode: nodeCode.trim(),
      nodeType,
      processNodeId: processNodeId || undefined,
      instructions: instructions.trim() || undefined,
      fields: fieldsWithRules,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* 1. Header do Modal Macro */}
        <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Configuração Avançada do Nó: {nodeLabel}
                </h2>
                {isStart ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800 border border-emerald-200">
                    Ponto de Partida / Confecção
                  </span>
                ) : (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-indigo-800 border border-indigo-200">
                    Etapa de Tramitação
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Gerencie os campos, regras condicionais dinâmicas, validações e diretrizes operacionais desta fase.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2. Navegação de Abas do Modal */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'fields'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            1. Campos do Nó ({nodeFields.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'rules'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            2. Regras Condicionais de Campos ({rulesList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'details'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="h-4 w-4" />
            3. Dados da Etapa & Instruções
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'simulator'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
            4. Simulador do Nó em Tempo Real
          </button>
        </div>

        {/* 3. Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* ================= ABA 1: CAMPOS DO NÓ ================= */}
          {activeTab === 'fields' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Campos Habilitados neste Nó
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure a obrigatoriedade, visibilidade e rótulos específicos para este processo sem afetar outros fluxos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCatalogPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  + Adicionar Campo do Catálogo
                </button>
              </div>

              {/* Modal / Dropdown Flutuante de Seleção do Catálogo */}
              {isCatalogPickerOpen && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">
                      Selecione campos do catálogo da área para incluir neste nó:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCatalogPickerOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Fechar
                    </button>
                  </div>

                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Filtrar por nome ou código..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableCatalogFields
                      .filter(
                        (f) =>
                          !catalogSearch ||
                          f.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                          f.code.toLowerCase().includes(catalogSearch.toLowerCase())
                      )
                      .map((fieldDef) => {
                        const isAlreadyAdded = nodeFields.some(
                          (nf) => nf.fieldDefinitionId === fieldDef.id
                        );
                        const Icon = FIELD_TYPE_ICONS[fieldDef.type] || Type;

                        return (
                          <button
                            key={fieldDef.id}
                            type="button"
                            disabled={isAlreadyAdded}
                            onClick={() => handleAddFieldToNode(fieldDef.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition ${
                              isAlreadyAdded
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 opacity-80 cursor-default'
                                : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                              <div className="min-w-0">
                                <span className="font-bold truncate block">{fieldDef.name}</span>
                                <span className="font-mono text-[10px] text-slate-400 block">
                                  {fieldDef.code}
                                </span>
                              </div>
                            </div>
                            {isAlreadyAdded ? (
                              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Plus className="h-4 w-4 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Lista dos Campos já Adicionados */}
              <div className="space-y-3">
                {nodeFields.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                    Nenhum campo vinculado a este nó. Clique em "+ Adicionar Campo do Catálogo" acima.
                  </div>
                ) : (
                  nodeFields.map((nodeField, idx) => {
                    const def = getFieldDef(nodeField.fieldDefinitionId);
                    const Icon = FIELD_TYPE_ICONS[def?.type || FieldType.Text] || Type;
                    const relatedRulesCount = rulesList.filter(
                      (r) =>
                        r.sourceFieldId === nodeField.fieldDefinitionId ||
                        r.targetFieldIds.includes(nodeField.fieldDefinitionId)
                    ).length;

                    return (
                      <div
                        key={nodeField.fieldDefinitionId}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 transition hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 font-mono text-xs font-bold text-indigo-700">
                              #{idx + 1}
                            </span>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-900">
                                  {def?.name || 'Campo não encontrado'}
                                </h4>
                                {relatedRulesCount > 0 && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.2 text-[10px] font-bold text-amber-700 border border-amber-200">
                                    {relatedRulesCount} {relatedRulesCount === 1 ? 'regra' : 'regras'}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[10px] text-slate-400">
                                {def?.code}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFieldFromNode(nodeField.fieldDefinitionId)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Remover campo deste nó"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Controles de Configuração do Campo */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Rótulo Personalizado (Opcional)
                            </label>
                            <input
                              type="text"
                              value={nodeField.customLabel || ''}
                              onChange={(e) =>
                                handleUpdateNodeField(
                                  nodeField.fieldDefinitionId,
                                  'customLabel',
                                  e.target.value
                                )
                              }
                              placeholder={def?.name}
                              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Texto de Ajuda / Placeholder
                            </label>
                            <input
                              type="text"
                              value={nodeField.helpText || ''}
                              onChange={(e) =>
                                handleUpdateNodeField(
                                  nodeField.fieldDefinitionId,
                                  'helpText',
                                  e.target.value
                                )
                              }
                              placeholder="Orientações específicas..."
                              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                            />
                          </div>

                          {/* Flags Booleanas Específicas do Nó */}
                          <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-4">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={nodeField.isRequired}
                                onChange={(e) =>
                                  handleUpdateNodeField(
                                    nodeField.fieldDefinitionId,
                                    'isRequired',
                                    e.target.checked
                                  )
                                }
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>Obrigatório neste Nó</span>
                            </label>

                            <label
                              className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer"
                              title="Se marcado, o campo não aparece inicialmente no formulário, a menos que uma regra condicional o exiba ou o preencha."
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(nodeField.isHidden)}
                                onChange={(e) =>
                                  handleUpdateNodeField(
                                    nodeField.fieldDefinitionId,
                                    'isHidden',
                                    e.target.checked
                                  )
                                }
                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="text-purple-900 font-bold">Oculto Inicialmente</span>
                            </label>

                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(nodeField.isReadonly)}
                                onChange={(e) =>
                                  handleUpdateNodeField(
                                    nodeField.fieldDefinitionId,
                                    'isReadonly',
                                    e.target.checked
                                  )
                                }
                                className="rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                              />
                              <span>Somente Leitura</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= ABA 2: REGRAS CONDICIONAIS DE CAMPOS ================= */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Form Construtor de Nova Regra */}
              <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Criar Nova Regra Condicional
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Defina interações dinâmicas entre campos (ex: exibir, ocultar, obrigar ou preencher valores automaticamente).
                    </p>
                  </div>
                </div>

                {ruleError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                    {ruleError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* 1. Campo Motivador */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. Campo Motivador (Gatilho) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newRuleSourceId}
                      onChange={(e) => {
                        setNewRuleSourceId(e.target.value);
                        setNewRuleExpectedValue('');
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione o campo...</option>
                      {nodeFields.map((nf) => {
                        const def = getFieldDef(nf.fieldDefinitionId);
                        return (
                          <option key={nf.fieldDefinitionId} value={nf.fieldDefinitionId}>
                            {nf.customLabel || def?.name} ({def?.code})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 2. Condição / Operador */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      2. Condição / Comparação <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newRuleOperator}
                      onChange={(e) =>
                        setNewRuleOperator(e.target.value as FieldConditionRule['operator'])
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                    >
                      {Object.entries(OPERATOR_LABELS).map(([opKey, opLabel]) => (
                        <option key={opKey} value={opKey}>
                          {opLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Valor Esperado */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      3. Valor Esperado
                    </label>
                    {newRuleOperator === 'Filled' || newRuleOperator === 'Empty' ? (
                      <input
                        type="text"
                        disabled
                        value={newRuleOperator === 'Filled' ? '[Qualquer Valor Preenchido]' : '[Campo Vazio]'}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-500 font-mono"
                      />
                    ) : sourceFieldOptions.length > 0 ? (
                      <select
                        value={newRuleExpectedValue}
                        onChange={(e) => setNewRuleExpectedValue(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="">Selecione o valor esperado...</option>
                        {sourceFieldOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newRuleExpectedValue}
                        onChange={(e) => setNewRuleExpectedValue(e.target.value)}
                        placeholder="Ex: Sim, Aprovado, 1000..."
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
                  {/* 4. Ação a Executar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      4. Ação / Efeito nos Campos Alvo <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newRuleAction}
                      onChange={(e) =>
                        setNewRuleAction(e.target.value as FieldConditionRule['action'])
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                    >
                      {Object.entries(ACTION_LABELS).map(([actKey, actItem]) => (
                        <option key={actKey} value={actKey}>
                          {actItem.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5. Valor a Atribuir (Apenas se ação for SetValue) */}
                  {newRuleAction === 'SetValue' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Valor a Preencher no Alvo <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newRuleTargetValue}
                        onChange={(e) => setNewRuleTargetValue(e.target.value)}
                        placeholder="Ex: VALIDADO, HOMOLOGADO..."
                        className="w-full rounded-xl border border-purple-300 bg-purple-50/40 px-3 py-2 text-xs text-purple-900 font-bold outline-none focus:border-purple-500"
                      />
                    </div>
                  )}

                  {/* 6. Descrição Opcional */}
                  <div className={newRuleAction === 'SetValue' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Rótulo / Descrição da Regra (Opcional)
                    </label>
                    <input
                      type="text"
                      value={newRuleDescription}
                      onChange={(e) => setNewRuleDescription(e.target.value)}
                      placeholder="Ex: Exibir campo de conta quando solicitar cartão..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Seleção Múltipla de Campos Alvo */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700">
                    5. Selecione os Campos Alvo afetados por esta regra: <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {nodeFields
                      .filter((nf) => nf.fieldDefinitionId !== newRuleSourceId)
                      .map((nf) => {
                        const def = getFieldDef(nf.fieldDefinitionId);
                        const isChecked = newRuleTargetIds.includes(nf.fieldDefinitionId);

                        return (
                          <label
                            key={nf.fieldDefinitionId}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                              isChecked
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewRuleTargetIds((prev) => [...prev, nf.fieldDefinitionId]);
                                } else {
                                  setNewRuleTargetIds((prev) =>
                                    prev.filter((id) => id !== nf.fieldDefinitionId)
                                  );
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate">{nf.customLabel || def?.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Regra Condicional
                  </button>
                </div>
              </div>

              {/* Lista de Regras Cadastradas */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Regras Ativas neste Nó ({rulesList.length})
                </h3>

                {rulesList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                    Nenhuma regra condicional cadastrada. Use o formulário acima para adicionar lógicas condicionais.
                  </div>
                ) : (
                  rulesList.map((rule, idx) => {
                    const sourceDef = getFieldDef(rule.sourceFieldId);
                    const actionInfo = ACTION_LABELS[rule.action] || ACTION_LABELS.Show;

                    return (
                      <div
                        key={rule.id || idx}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5 transition hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 font-mono text-xs font-bold text-amber-700">
                              R{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {rule.description || 'Regra Condicional'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => rule.id && handleRemoveRule(rule.id)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Remover regra"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Linguagem Natural da Regra */}
                        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200 flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-500">SE</span>
                          <span className="rounded-md bg-white px-2 py-0.5 font-bold text-slate-900 border border-slate-300">
                            {sourceDef?.name || rule.sourceFieldId}
                          </span>
                          <span className="font-bold text-indigo-600">
                            {OPERATOR_LABELS[rule.operator]}
                          </span>
                          {rule.expectedValue && (
                            <span className="rounded-md bg-white px-2 py-0.5 font-mono font-bold text-indigo-900 border border-indigo-200">
                              "{rule.expectedValue}"
                            </span>
                          )}
                          <span className="font-bold text-slate-500">➔ ENTÃO</span>
                          <span className={`rounded-md px-2 py-0.5 font-bold border ${actionInfo.badgeColor}`}>
                            {actionInfo.label}
                          </span>
                          {rule.targetValue && (
                            <span className="font-bold text-purple-700">
                              com valor "{rule.targetValue}"
                            </span>
                          )}
                          <span className="font-bold text-slate-500">nos campos:</span>
                          <div className="flex flex-wrap gap-1">
                            {rule.targetFieldIds.map((tId) => (
                              <span
                                key={tId}
                                className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 border border-slate-200"
                              >
                                {getFieldDef(tId)?.name || tId}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= ABA 3: DADOS DA ETAPA & INSTRUÇÕES ================= */}
          {activeTab === 'details' && (
            <div className="space-y-4 rounded-3xl bg-white p-6 border border-slate-200 shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vínculo com Local do Catálogo
                  </label>
                  <select
                    value={processNodeId}
                    onChange={(e) => handleCatalogNodeChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">Selecione um local do catálogo...</option>
                    {availableCatalogNodes.map((cn) => (
                      <option key={cn.id} value={cn.id}>
                        {cn.name} ({cn.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome / Rótulo de Exibição deste Nó <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nodeLabel}
                    onChange={(e) => setNodeLabel(e.target.value)}
                    placeholder="Ex: Análise Jurídica"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Código do Nó <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nodeCode}
                    onChange={(e) => setNodeCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="analise_juridica"
                    className="w-full font-mono rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Natureza da Etapa
                  </label>
                  <select
                    value={nodeType}
                    onChange={(e) => setNodeType(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value={ProcessNodeType.StartConfection}>Confecção / Ponto de Partida</option>
                    <option value={ProcessNodeType.StandardStage}>Tramitação / Análise</option>
                    <option value={ProcessNodeType.ApprovalStage}>Decisão / Parecer</option>
                    <option value={ProcessNodeType.EndArchived}>Conclusão / Arquivamento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instruções & Checklist Operacional desta Fase
                </label>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Descreva o passo a passo, critérios de análise e parecer que o responsável deve seguir ao tramitar nesta etapa..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* ================= ABA 4: SIMULADOR INTERATIVO DO NÓ ================= */}
          {activeTab === 'simulator' && (
            <div className="space-y-4 rounded-3xl bg-white p-6 border border-slate-200 shadow-sm">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Simulador Interativo do Formulário deste Nó
                </h3>
                <p className="text-[11px] text-slate-500">
                  Digite valores nos campos abaixo para testar o disparo das regras condicionais e o preenchimento automático em tempo real:
                </p>
              </div>

              <div className="space-y-4 max-w-xl">
                {nodeFields.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    Nenhum campo adicionado neste nó para simular.
                  </div>
                ) : (
                  nodeFields.map((nf) => {
                    const def = getFieldDef(nf.fieldDefinitionId);
                    const isHiddenByDefault = Boolean(nf.isHidden);
                    const isEvaluatedHidden = evaluatedSimulator.hiddenFieldIds.has(nf.fieldDefinitionId);
                    const isActuallyHidden = isHiddenByDefault
                      ? !rulesList.some(
                          (r) =>
                            r.action === 'Show' &&
                            r.targetFieldIds.includes(nf.fieldDefinitionId) &&
                            !isEvaluatedHidden
                        )
                      : isEvaluatedHidden;

                    const isRequired =
                      nf.isRequired ||
                      evaluatedSimulator.requiredFieldIds.has(nf.fieldDefinitionId);
                    const isDisabled =
                      Boolean(nf.isReadonly) ||
                      evaluatedSimulator.disabledFieldIds.has(nf.fieldDefinitionId);

                    const autoValue = evaluatedSimulator.setFieldValues[nf.fieldDefinitionId];
                    const currentValue = autoValue !== undefined ? autoValue : (simulatorValues[nf.fieldDefinitionId] || '');

                    if (isActuallyHidden) {
                      return (
                        <div
                          key={nf.fieldDefinitionId}
                          className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-400 italic flex items-center justify-between"
                        >
                          <span>Campo [{nf.customLabel || def?.name}] oculto pela regra/configuração</span>
                          <span className="text-[10px] font-mono font-bold uppercase bg-slate-200 px-1.5 py-0.5 rounded">
                            Oculto
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={nf.fieldDefinitionId} className="space-y-1 animate-fadeIn">
                        <label className="block text-xs font-bold text-slate-800">
                          {nf.customLabel || def?.name}
                          {isRequired && <span className="text-rose-500 ml-0.5">*</span>}
                          {isDisabled && (
                            <span className="ml-2 text-[10px] font-semibold text-slate-400">
                              (Somente Leitura)
                            </span>
                          )}
                          {autoValue !== undefined && (
                            <span className="ml-2 text-[10px] font-bold text-purple-600">
                              (Preenchido Automaticamente por Regra)
                            </span>
                          )}
                        </label>

                        {def?.type === FieldType.Select ? (
                          <select
                            disabled={isDisabled}
                            value={currentValue}
                            onChange={(e) =>
                              setSimulatorValues((prev) => ({
                                ...prev,
                                [nf.fieldDefinitionId]: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                          >
                            <option value="">Selecione...</option>
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                            <option value="Aprovado">Aprovado</option>
                            <option value="Reprovado">Reprovado</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            disabled={isDisabled}
                            value={currentValue}
                            onChange={(e) =>
                              setSimulatorValues((prev) => ({
                                ...prev,
                                [nf.fieldDefinitionId]: e.target.value,
                              }))
                            }
                            placeholder={nf.helpText || def?.placeholder || 'Digite para testar...'}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Rodapé do Modal Macro */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmSave}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aplicar Configurações no Nó
          </button>
        </div>
      </div>
    </div>
  );
};
