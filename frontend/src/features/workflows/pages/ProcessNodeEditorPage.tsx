import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  GitCommit,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/providers';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import * as workflowsApi from '../api';
import type { ProcessNode, ProcessNodeTypeValue } from '../types';
import { ProcessNodeType } from '../types';

const NODE_TYPE_OPTIONS: Array<{
  value: ProcessNodeTypeValue;
  label: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    value: ProcessNodeType.StartConfection,
    label: 'Confecção / Abertura Inicial',
    badge: 'Início Obrigatório',
    badgeColor: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    icon: Sparkles,
    description: 'Etapa inicial onde o solicitante preenche os dados do protocolo e submete o processo.',
  },
  {
    value: ProcessNodeType.StandardStage,
    label: 'Etapa de Tramitação / Atendimento',
    badge: 'Execução / Análise',
    badgeColor: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: Layers,
    description: 'Etapa intermediária onde a equipe responsável analisa, preenche campos complementares ou despacha.',
  },
  {
    value: ProcessNodeType.ApprovalStage,
    label: 'Etapa Decisória / Aprovação',
    badge: 'Decisão / Parecer',
    badgeColor: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: FileCheck2,
    description: 'Etapa com foco em deferimento, indeferimento, assinatura ou emissão de parecer formal.',
  },
  {
    value: ProcessNodeType.EndArchived,
    label: 'Conclusão / Arquivamento',
    badge: 'Fim do Fluxo',
    badgeColor: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: CheckCircle2,
    description: 'Etapa terminal do processo (Arquivamento - Deferido ou Arquivamento - Indeferido).',
  },
];

// Presets de locais de processo recomendados / padrões
const RECOMMENDED_PRESETS = [
  {
    name: 'Confecção',
    code: 'confeccao',
    nodeType: ProcessNodeType.StartConfection,
    description: 'Local inicial padrão de preenchimento e confecção de solicitação.',
  },
  {
    name: 'Arquivamento - Deferido',
    code: 'arquivamento_deferido',
    nodeType: ProcessNodeType.EndArchived,
    description: 'Finalização e arquivamento do processo com solicitação aprovada / deferida.',
  },
  {
    name: 'Arquivamento - Indeferido',
    code: 'arquivamento_indeferido',
    nodeType: ProcessNodeType.EndArchived,
    description: 'Finalização e arquivamento do processo com solicitação reprovada / indeferida.',
  },
  {
    name: 'Análise Técnica / Triagem',
    code: 'analise_tecnica',
    nodeType: ProcessNodeType.StandardStage,
    description: 'Etapa de conferência e triagem de documentos recebidos.',
  },
  {
    name: 'Parecer da Gestão',
    code: 'parecer_gestao',
    nodeType: ProcessNodeType.ApprovalStage,
    description: 'Etapa para deliberação e despacho da chefia responsável.',
  },
];

export const ProcessNodeEditorPage: React.FC = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEditing = Boolean(nodeId && nodeId !== 'new');
  const targetAreaId = searchParams.get('areaId') || '';

  // Estados do Formulário
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [nodeType, setNodeType] = useState<ProcessNodeTypeValue>(ProcessNodeType.StandardStage);
  const [isActive, setIsActive] = useState(true);
  const [areaId, setAreaId] = useState(targetAreaId);

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

  // Carregar Local se for Edição
  useEffect(() => {
    if (isEditing && nodeId) {
      setLoading(true);
      workflowsApi
        .getNodeById(nodeId)
        .then((node: ProcessNode) => {
          setName(node.name);
          setCode(node.code);
          setDescription(node.description || '');
          setNodeType(node.nodeType);
          setIsActive(node.isActive);
          setAreaId(node.areaId);
        })
        .catch((err) => {
          setFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'Não foi possível carregar o local de processo.',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isEditing, nodeId]);

  // Aplicar Preset
  const handleApplyPreset = (preset: typeof RECOMMENDED_PRESETS[0]) => {
    setName(preset.name);
    setCode(preset.code);
    setNodeType(preset.nodeType);
    setDescription(preset.description);
  };

  // Salvar Local
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', text: 'Informe o nome do local de processo.' });
      return;
    }
    if (!code.trim()) {
      setFeedback({ type: 'error', text: 'Informe o identificador do local.' });
      return;
    }
    if (!areaId) {
      setFeedback({ type: 'error', text: 'Selecione a área responsável.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      if (isEditing && nodeId) {
        await workflowsApi.updateNode(nodeId, {
          name: name.trim(),
          description: description.trim() || undefined,
          nodeType,
          isActive,
        });
        setFeedback({ type: 'success', text: 'Local de processo atualizado com sucesso!' });
      } else {
        await workflowsApi.createNode(areaId, {
          code: code.trim().toLowerCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          nodeType,
        });
        setFeedback({ type: 'success', text: 'Local de processo criado com sucesso!' });
      }

      setTimeout(() => {
        navigate(`/app/workflows?areaId=${areaId}`);
      }, 700);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar o local de processo.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-xs font-semibold text-slate-500">Carregando local de processo...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
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
            {isEditing ? 'Editar Local de Processo' : 'Novo Local de Processo'}
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
            {isEditing ? 'Salvar Alterações' : 'Criar Local de Processo'}
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

      {/* Sugestões Rápidas de Modelos (Apenas na criação) */}
      {!isEditing && (
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-indigo-900">
              Modelos Rápidos de Locais de Processo
            </h3>
          </div>
          <p className="text-[11px] text-slate-600 mb-3">
            Clique em um dos padrões abaixo para preencher automaticamente as definições recomendadas:
          </p>
          <div className="flex flex-wrap gap-2">
            {RECOMMENDED_PRESETS.map((preset) => (
              <button
                key={preset.code}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-600 hover:text-white hover:border-transparent transition"
              >
                + {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Card 1: Identificação */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <GitCommit className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">1. Dados do Local de Processo</h2>
            <p className="text-xs text-slate-500">
              Nome da etapa, departamento de atuação e código de identificação no fluxo.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Nome do Local de Processo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Análise Jurídica de Contratos"
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
              placeholder="analise_juridica"
              className="mt-1.5 w-full font-mono rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 outline-none disabled:opacity-75 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
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

          {isEditing && (
            <div>
              <label className="block text-xs font-bold text-slate-700">Status do Local</label>
              <select
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="active">Ativo no Sistema</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700">
            Descrição / Diretrizes Operacionais
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva a finalidade desta etapa de atendimento, requisitos de parecer ou orientações aos responsáveis..."
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Card 2: Natureza / Tipo da Etapa */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">2. Natureza & Comportamento do Local</h2>
            <p className="text-xs text-slate-500">
              Indique o papel que este local desempenhará dentro dos grafos de árvores de decisão.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NODE_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = nodeType === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNodeType(opt.value)}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
