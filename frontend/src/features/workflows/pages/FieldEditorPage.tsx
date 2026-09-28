import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
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
  Eye,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/providers';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import * as workflowsApi from '../api';
import type { FieldDefinition, FieldTypeValue } from '../types';
import { FieldType } from '../types';
import {
  applyCurrencyMask,
  applyCpfMask,
  applyCnpjMask,
  applyCustomMask,
} from '../utils/maskUtils';

// Configuração visual dos tipos de campos
const FIELD_TYPE_OPTIONS: Array<{
  value: FieldTypeValue;
  label: string;
  badge: string;
  icon: React.ElementType;
  description: string;
  category: 'Texto' | 'Números & Moeda' | 'Documentos' | 'Seleção' | 'Outros';
}> = [
  {
    value: FieldType.Text,
    label: 'Texto Simples',
    badge: 'Máscara Opcional',
    icon: Type,
    description: 'Texto em linha única para nomes, títulos ou com máscara personalizada (ex: telefone, CEP).',
    category: 'Texto',
  },
  {
    value: FieldType.TextArea,
    label: 'Texto Longo',
    badge: 'Multilinha',
    icon: AlignLeft,
    description: 'Área de texto expansível para justificativas, observações, laudos ou pareceres detalhados.',
    category: 'Texto',
  },
  {
    value: FieldType.Currency,
    label: 'Moeda (R$)',
    badge: 'Padrão R$ 9.999,99',
    icon: DollarSign,
    description: 'Valor monetário formatado automaticamente no padrão da moeda Real brasileira.',
    category: 'Números & Moeda',
  },
  {
    value: FieldType.Number,
    label: 'Número',
    badge: 'Inteiro ou Decimal',
    icon: Hash,
    description: 'Entrada exclusivamente numérica para quantidades, percentuais ou contadores.',
    category: 'Números & Moeda',
  },
  {
    value: FieldType.Cpf,
    label: 'CPF',
    badge: '999.999.999-99',
    icon: CreditCard,
    description: 'Documento de pessoa física com formatação e máscara automática de CPF.',
    category: 'Documentos',
  },
  {
    value: FieldType.Cnpj,
    label: 'CNPJ',
    badge: '99.999.999/9999-99',
    icon: Building,
    description: 'Cadastro Nacional de Pessoa Jurídica com formatação e máscara automática de CNPJ.',
    category: 'Documentos',
  },
  {
    value: FieldType.Date,
    label: 'Data',
    badge: 'DD/MM/AAAA',
    icon: Calendar,
    description: 'Seletor de data para prazos, nascimento, vencimentos ou marcos do processo.',
    category: 'Outros',
  },
  {
    value: FieldType.Select,
    label: 'Seleção Única (Dropdown)',
    badge: '1 Escolha',
    icon: ListFilter,
    description: 'Menu suspenso para o usuário selecionar uma única opção pré-definida.',
    category: 'Seleção',
  },
  {
    value: FieldType.MultiSelect,
    label: 'Múltipla Seleção',
    badge: 'Várias Escolhas',
    icon: CheckSquare,
    description: 'Permite selecionar múltiplas opções a partir de uma lista dinâmica configurada.',
    category: 'Seleção',
  },
  {
    value: FieldType.Boolean,
    label: 'Booleano (Sim / Não)',
    badge: 'Interruptor',
    icon: ToggleLeft,
    description: 'Interruptor para confirmações objetivas de Sim/Não, De acordo ou Termos aceitos.',
    category: 'Outros',
  },
  {
    value: FieldType.FileAttachment,
    label: 'Anexo de Arquivo',
    badge: 'Upload de Docs',
    icon: Paperclip,
    description: 'Upload de arquivos digitais (PDF, relatórios, imagens, planilhas ou comprovantes).',
    category: 'Outros',
  },
];

// Presets de máscaras personalizadas comuns
const MASK_PRESETS = [
  { label: 'Celular / WhatsApp', mask: '(99) 99999-9999' },
  { label: 'Telefone Fixo', mask: '(99) 9999-9999' },
  { label: 'CEP', mask: '99999-999' },
  { label: 'Placa de Veículo', mask: 'AAA-9999' },
  { label: 'Processo / Protocolo', mask: '9999.999/9999' },
];

export const FieldEditorPage: React.FC = () => {
  const { fieldId } = useParams<{ fieldId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEditing = Boolean(fieldId && fieldId !== 'new');
  const targetAreaId = searchParams.get('areaId') || '';

  // Estados do Formulário
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [type, setType] = useState<FieldTypeValue>(FieldType.Text);
  const [isActive, setIsActive] = useState(true);
  const [areaId, setAreaId] = useState(targetAreaId);

  // Estados Específicos por Tipo
  // 1. Para Texto Simples: Máscara personalizada
  const [useCustomMask, setUseCustomMask] = useState(false);
  const [customMaskPattern, setCustomMaskPattern] = useState('');

  // 2. Para Select e MultiSelect: Opções dinâmicas
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');

  // Estados de Live Preview (para testar o campo em tempo real)
  const [previewValue, setPreviewValue] = useState<any>('');
  const [previewMultiValues, setPreviewMultiValues] = useState<string[]>([]);

  // Carregamento e Feedback
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-gerar código a partir do nome
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing) {
      const generatedCode = val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setCode(generatedCode);
    }
  };

  // Carregar Áreas da Empresa
  useEffect(() => {
    if (user?.companyId) {
      getAreasByCompanyId(user.companyId)
        .then((data) => {
          const activeAreas = data.filter((a) => a.isActive);
          setAreas(activeAreas);
          if (!areaId && activeAreas.length > 0) {
            setAreaId(activeAreas[0].id);
          }
        })
        .catch(() => {});
    }
  }, [user?.companyId, areaId]);

  // Carregar Campo se for Edição
  useEffect(() => {
    if (isEditing && fieldId) {
      setLoading(true);
      workflowsApi
        .getFieldById(fieldId)
        .then((field: FieldDefinition) => {
          setName(field.name);
          setCode(field.code);
          setDescription(field.description || '');
          setPlaceholder(field.placeholder || '');
          setType(field.type);
          setIsActive(field.isActive);
          setAreaId(field.areaId);

          // Parse do globalOptionsJson
          if (field.globalOptionsJson) {
            try {
              const parsed = JSON.parse(field.globalOptionsJson);
              if (Array.isArray(parsed)) {
                setOptionsList(parsed);
              } else if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.options)) {
                  setOptionsList(parsed.options);
                }
                if (parsed.mask) {
                  setUseCustomMask(true);
                  setCustomMaskPattern(parsed.mask);
                }
              }
            } catch {
              // fallback se for string separada por vírgula
              setOptionsList(
                field.globalOptionsJson.split(',').map((s) => s.trim()).filter(Boolean)
              );
            }
          }
        })
        .catch((err) => {
          setFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'Não foi possível carregar o campo.',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isEditing, fieldId]);

  // Adicionar Opção à Lista
  const handleAddOption = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newOptionInput.trim();
    if (!clean) return;

    if (optionsList.includes(clean)) {
      setFeedback({ type: 'error', text: 'Esta opção já foi adicionada.' });
      return;
    }

    setOptionsList((prev) => [...prev, clean]);
    setNewOptionInput('');
  };

  const handleRemoveOption = (indexToRemove: number) => {
    setOptionsList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Montar JSON de Opções Globais
  const buildGlobalOptionsJson = (): string | undefined => {
    if (type === FieldType.Select || type === FieldType.MultiSelect) {
      return JSON.stringify(optionsList);
    }
    if (type === FieldType.Text && useCustomMask && customMaskPattern) {
      return JSON.stringify({ mask: customMaskPattern.trim() });
    }
    return undefined;
  };

  // Salvar Campo
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', text: 'Informe o nome do campo.' });
      return;
    }
    if (!code.trim()) {
      setFeedback({ type: 'error', text: 'Informe o identificador do campo.' });
      return;
    }
    if (!areaId) {
      setFeedback({ type: 'error', text: 'Selecione a área responsável pelo campo.' });
      return;
    }
    if ((type === FieldType.Select || type === FieldType.MultiSelect) && optionsList.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Adicione pelo menos uma opção para campos de seleção.',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const globalOptionsJson = buildGlobalOptionsJson();

      if (isEditing && fieldId) {
        await workflowsApi.updateField(fieldId, {
          name: name.trim(),
          description: description.trim() || undefined,
          placeholder: placeholder.trim() || undefined,
          type,
          globalOptionsJson,
          isActive,
        });
        setFeedback({ type: 'success', text: 'Campo atualizado com sucesso!' });
      } else {
        await workflowsApi.createField(areaId, {
          code: code.trim().toLowerCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          placeholder: placeholder.trim() || undefined,
          type,
          globalOptionsJson,
        });
        setFeedback({ type: 'success', text: 'Campo criado com sucesso!' });
      }

      setTimeout(() => {
        navigate(`/app/workflows?areaId=${areaId}`);
      }, 700);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar o campo.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Manipulador de digitação no Live Preview com máscara em tempo real
  const handlePreviewInputChange = (rawVal: string) => {
    if (type === FieldType.Currency) {
      setPreviewValue(applyCurrencyMask(rawVal));
    } else if (type === FieldType.Cpf) {
      setPreviewValue(applyCpfMask(rawVal));
    } else if (type === FieldType.Cnpj) {
      setPreviewValue(applyCnpjMask(rawVal));
    } else if (type === FieldType.Text && useCustomMask && customMaskPattern) {
      setPreviewValue(applyCustomMask(rawVal, customMaskPattern));
    } else {
      setPreviewValue(rawVal);
    }
  };

  const selectedTypeConfig = useMemo(() => {
    return FIELD_TYPE_OPTIONS.find((opt) => opt.value === type) || FIELD_TYPE_OPTIONS[0];
  }, [type]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-xs font-semibold text-slate-500">Carregando dados do campo...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* 1. Header de Navegação Superior */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/app/workflows?areaId=${areaId}`)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Workflows
          </button>
          <span className="text-xs font-medium text-slate-300">/</span>
          <span className="text-xs font-bold text-slate-600">
            {isEditing ? 'Editar Campo' : 'Novo Campo Personalizado'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/app/workflows?areaId=${areaId}`)}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Salvar Alterações' : 'Criar Campo'}
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-4 text-xs font-semibold shadow-sm transition-all ${
            feedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Grid Principal: 2 Colunas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUNA 1: FORMULÁRIO DE CONFIGURAÇÃO (7 COLUNAS) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card 1: Identificação do Campo */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Type className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">1. Identificação do Campo</h2>
                <p className="text-xs text-slate-500">
                  Nome, identificador interno e instruções de preenchimento.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Nome de Exibição do Campo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Valor da Nota Fiscal"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Identificador / Código <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="valor_nota_fiscal"
                  className="mt-1.5 w-full font-mono rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 outline-none disabled:opacity-75 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-[10px] text-slate-400">
                  Identificador único para regras e condicionais.
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700">Área Responsável</label>
                <select
                  value={areaId}
                  disabled={isEditing}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Texto Placeholder</label>
                <input
                  type="text"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="Ex: Digite o valor constante na NF..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Descrição / Texto de Ajuda</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explique orientações adicionais aos solicitantes e atendentes deste campo..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Card 2: Seleção de Tipo de Dado */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">2. Formato & Tipo de Dado</h2>
                <p className="text-xs text-slate-500">
                  Escolha como a informação será inserida e validada no sistema.
                </p>
              </div>
            </div>

            {/* Grid dos Tipos de Campo */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {FIELD_TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = type === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setType(opt.value);
                      setPreviewValue('');
                      setPreviewMultiValues([]);
                    }}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {opt.label}
                        </span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 shrink-0">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-tight text-slate-500 line-clamp-2">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3: Configurações Específicas do Tipo */}
          {/* A. Opções para Dropdown / MultiSelect */}
          {(type === FieldType.Select || type === FieldType.MultiSelect) && (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ListFilter className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    3. Opções da Lista de Seleção
                  </h2>
                  <p className="text-xs text-slate-500">
                    Adicione os itens que ficarão disponíveis para escolha no formulário.
                  </p>
                </div>
              </div>

              {/* Input com botão + */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOptionInput}
                  onChange={(e) => setNewOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                  placeholder="Digite o nome da opção e clique em Adicionar (+)..."
                  className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>

              {/* Lista de Opções Cadastradas com - para remover */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Opções Adicionadas ({optionsList.length})
                </span>

                {optionsList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                    Nenhuma opção adicionada ainda. Digite acima e pressione Enter.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {optionsList.map((option, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs transition hover:bg-slate-100"
                      >
                        <span className="font-semibold text-slate-800">{option}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Remover opção"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* B. Configuração de Máscara Personalizada para Texto Simples */}
          {type === FieldType.Text && (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Info className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      3. Máscara de Formatação Personalizada
                    </h2>
                    <p className="text-xs text-slate-500">
                      Defina um padrão de preenchimento estruturado para o texto.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomMask}
                    onChange={(e) => setUseCustomMask(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Habilitar Máscara</span>
                </label>
              </div>

              {useCustomMask && (
                <div className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Padrão da Máscara (Use <code className="text-indigo-600 font-mono">9</code> para números, <code className="text-indigo-600 font-mono">A</code> para letras)
                    </label>
                    <input
                      type="text"
                      value={customMaskPattern}
                      onChange={(e) => setCustomMaskPattern(e.target.value)}
                      placeholder="Ex: (99) 99999-9999 ou 99999-999"
                      className="mt-1.5 w-full font-mono rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  {/* Presets Rápidos */}
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                      Padrões Prontos:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {MASK_PRESETS.map((preset) => (
                        <button
                          key={preset.mask}
                          type="button"
                          onClick={() => setCustomMaskPattern(preset.mask)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                        >
                          {preset.label}: <span className="font-mono">{preset.mask}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUNA 2: LIVE INTERACTIVE PREVIEW (5 COLUNAS) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="sticky top-6 rounded-3xl bg-gradient-to-b from-slate-900 to-indigo-950 p-6 text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Visualização Interativa em Tempo Real</h3>
              </div>
              <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 ring-1 ring-indigo-400/30">
                Preview Vivo
              </span>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Teste abaixo a aparência e o comportamento de digitação exato do campo antes de salvá-lo:
            </p>

            {/* Container do Campo Renderizado */}
            <div className="mt-5 rounded-2xl bg-white p-5 text-slate-900 shadow-md space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  {name || 'Nome do Campo'} <span className="text-rose-500">*</span>
                </label>
                {description && (
                  <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
                )}
              </div>

              {/* RENDERIZAÇÃO DINÂMICA DO PREVIEW */}
              {/* 1. Texto Simples */}
              {type === FieldType.Text && (
                <input
                  type="text"
                  value={previewValue}
                  onChange={(e) => handlePreviewInputChange(e.target.value)}
                  placeholder={placeholder || (useCustomMask ? customMaskPattern : 'Digite o texto...')}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}

              {/* 2. Área de Texto Longo */}
              {type === FieldType.TextArea && (
                <textarea
                  rows={3}
                  value={previewValue}
                  onChange={(e) => setPreviewValue(e.target.value)}
                  placeholder={placeholder || 'Digite o texto detalhado...'}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}

              {/* 3. Moeda BRL */}
              {type === FieldType.Currency && (
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    value={previewValue}
                    onChange={(e) => handlePreviewInputChange(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3.5 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {/* 4. Número */}
              {type === FieldType.Number && (
                <input
                  type="number"
                  value={previewValue}
                  onChange={(e) => setPreviewValue(e.target.value)}
                  placeholder={placeholder || '0'}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}

              {/* 5. CPF */}
              {type === FieldType.Cpf && (
                <input
                  type="text"
                  maxLength={14}
                  value={previewValue}
                  onChange={(e) => handlePreviewInputChange(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full font-mono rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}

              {/* 6. CNPJ */}
              {type === FieldType.Cnpj && (
                <input
                  type="text"
                  maxLength={18}
                  value={previewValue}
                  onChange={(e) => handlePreviewInputChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full font-mono rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}

              {/* 7. Data */}
              {type === FieldType.Date && (
                <input
                  type="date"
                  value={previewValue}
                  onChange={(e) => setPreviewValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}

              {/* 8. Seleção Única (Dropdown) */}
              {type === FieldType.Select && (
                <select
                  value={previewValue}
                  onChange={(e) => setPreviewValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Selecione uma opção...</option>
                  {optionsList.map((opt, idx) => (
                    <option key={idx} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {/* 9. Múltipla Seleção */}
              {type === FieldType.MultiSelect && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {optionsList.map((opt, idx) => {
                      const isSelected = previewMultiValues.includes(opt);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setPreviewMultiValues((prev) =>
                              prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
                            );
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {optionsList.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">
                      Adicione opções no painel à esquerda para testar.
                    </p>
                  )}
                </div>
              )}

              {/* 10. Booleano */}
              {type === FieldType.Boolean && (
                <label className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span className="text-xs font-bold text-slate-800">
                    {placeholder || 'Confirmar / Aceitar'}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(previewValue)}
                    onChange={(e) => setPreviewValue(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              )}

              {/* 11. Anexo de Arquivo */}
              {type === FieldType.FileAttachment && (
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-4 text-center">
                  <Paperclip className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-1 text-xs font-bold text-slate-700">Clique para anexar documento</p>
                  <p className="text-[10px] text-slate-400">PDF, Imagens, Documentos</p>
                </div>
              )}
            </div>

            {/* Informações Técnicas do Campo */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Tipo Configurado:</span>
                <span className="font-bold text-indigo-200">{selectedTypeConfig.label}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Identificador no Banco:</span>
                <span className="font-mono font-semibold text-slate-200">{code || 'sem_codigo'}</span>
              </div>
              {useCustomMask && customMaskPattern && (
                <div className="flex justify-between text-slate-400">
                  <span>Máscara Ativa:</span>
                  <span className="font-mono font-semibold text-amber-300">{customMaskPattern}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
