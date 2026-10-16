import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Settings,
  Plus,
  Trash2,
  Tag,
  Lock,
} from 'lucide-react';
import { ProcessNodeType, type ProcessNodeTypeValue } from '../types';

export interface WorkflowCustomNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  code: string;
  nodeType: ProcessNodeTypeValue;
  processNodeId?: string;
  instructions?: string;
  fieldsCount: number;
  isStart?: boolean;
  onConfigure?: (id: string) => void;
  onAddChild?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export type WorkflowNodeType = Node<WorkflowCustomNodeData, 'workflowNode'>;

export interface NodeThemeToken {
  category: 'analysis' | 'confection' | 'approved' | 'rejected' | string;
  headerBg: string;
  borderClass: string;
  selectedRing: string;
  handleClass: string;
  icon: React.ElementType;
  badgeText: string;
  badgeClass: string;
  pillButtonHover: string;
  accentText: string;
  miniMapColor: string;
}

/**
 * Mapa escalável de tokens visuais para tipos de nós do fluxo
 * - Análise: Azul padrão
 * - Confecção: Amarelo
 * - Deferido: Verde
 * - Indeferido: Vermelho
 */
export const NODE_THEME_REGISTRY: Record<string, NodeThemeToken> = {
  // 1. Confecção: Amarelo
  confection: {
    category: 'confection',
    headerBg: 'bg-amber-500',
    borderClass: 'border-amber-400 hover:border-amber-500',
    selectedRing: 'ring-3 ring-amber-500/50 shadow-xl scale-[1.02]',
    handleClass: '!bg-amber-500',
    icon: Sparkles,
    badgeText: 'Confecção',
    badgeClass: 'bg-amber-100 text-amber-800',
    pillButtonHover: 'hover:bg-amber-50 hover:text-amber-800',
    accentText: 'text-amber-600',
    miniMapColor: '#f59e0b',
  },
  // 2. Análise: Azul padrão
  analysis: {
    category: 'analysis',
    headerBg: 'bg-blue-600',
    borderClass: 'border-blue-400 hover:border-blue-600',
    selectedRing: 'ring-3 ring-blue-500/50 shadow-xl scale-[1.02]',
    handleClass: '!bg-blue-600',
    icon: Layers,
    badgeText: 'Análise',
    badgeClass: 'bg-blue-100 text-blue-800',
    pillButtonHover: 'hover:bg-blue-50 hover:text-blue-700',
    accentText: 'text-blue-600',
    miniMapColor: '#2563eb',
  },
  // 3. Deferido: Verde
  approved: {
    category: 'approved',
    headerBg: 'bg-emerald-600',
    borderClass: 'border-emerald-400 hover:border-emerald-600',
    selectedRing: 'ring-3 ring-emerald-500/50 shadow-xl scale-[1.02]',
    handleClass: '!bg-emerald-600',
    icon: CheckCircle2,
    badgeText: 'Deferido',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    pillButtonHover: 'hover:bg-emerald-50 hover:text-emerald-700',
    accentText: 'text-emerald-600',
    miniMapColor: '#10b981',
  },
  // 4. Indeferido: Vermelho
  rejected: {
    category: 'rejected',
    headerBg: 'bg-rose-600',
    borderClass: 'border-rose-400 hover:border-rose-600',
    selectedRing: 'ring-3 ring-rose-500/50 shadow-xl scale-[1.02]',
    handleClass: '!bg-rose-600',
    icon: AlertCircle,
    badgeText: 'Indeferido',
    badgeClass: 'bg-rose-100 text-rose-800',
    pillButtonHover: 'hover:bg-rose-50 hover:text-rose-700',
    accentText: 'text-rose-600',
    miniMapColor: '#e11d48',
  },
};

/**
 * Função utilitária com resolução inteligente e escalável de tema
 */
export function resolveNodeTheme(data: WorkflowCustomNodeData): NodeThemeToken {
  const codeLower = (data.code || '').toLowerCase().trim();
  const labelLower = (data.label || '').toLowerCase().trim();

  // 1. Confecção (Amarelo)
  if (
    data.isStart ||
    data.nodeType === ProcessNodeType.StartConfection ||
    codeLower === 'confeccao' ||
    codeLower.startsWith('confeccao') ||
    labelLower.includes('confec')
  ) {
    return NODE_THEME_REGISTRY.confection;
  }

  // 2. Indeferido (Vermelho) - testado antes de deferido por especificidade
  if (
    data.nodeType === ProcessNodeType.EndRejected ||
    codeLower.includes('indeferido') ||
    labelLower.includes('indeferido')
  ) {
    return NODE_THEME_REGISTRY.rejected;
  }

  // 3. Deferido (Verde)
  if (
    data.nodeType === ProcessNodeType.EndApproved ||
    codeLower.includes('deferido') ||
    labelLower.includes('deferido')
  ) {
    return NODE_THEME_REGISTRY.approved;
  }

  // 4. Padrão: Análise (Azul padrão)
  return NODE_THEME_REGISTRY.analysis;
}

export const WorkflowCustomNode = memo(({ id, data, selected }: NodeProps<WorkflowNodeType>) => {
  const theme = resolveNodeTheme(data);
  const Icon = theme.icon;
  const isConfection = theme.category === 'confection';

  return (
    <div
      className={`group relative min-w-[240px] max-w-[280px] rounded-2xl bg-white shadow-md transition-all duration-200 border ${
        theme.borderClass
      } ${
        selected
          ? theme.selectedRing
          : 'ring-1 ring-slate-200 hover:shadow-lg'
      }`}
    >
      {/* Handles para conexões nos 4 eixos, coloridos pelo tema */}
      <Handle
        type="target"
        position={Position.Top}
        className={`!h-3.5 !w-3.5 !rounded-full !border-2 !border-white transition hover:!scale-125 shadow-xs ${theme.handleClass}`}
      />
      <Handle
        type="target"
        position={Position.Left}
        className={`!h-3.5 !w-3.5 !rounded-full !border-2 !border-white transition hover:!scale-125 shadow-xs ${theme.handleClass}`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!h-3.5 !w-3.5 !rounded-full !border-2 !border-white transition hover:!scale-125 shadow-xs ${theme.handleClass}`}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`!h-3.5 !w-3.5 !rounded-full !border-2 !border-white transition hover:!scale-125 shadow-xs ${theme.handleClass}`}
      />

      {/* Header do Card */}
      <div
        className={`flex items-center justify-between rounded-t-2xl px-3.5 py-2.5 text-white ${theme.headerBg}`}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {theme.badgeText}
          </span>
        </div>
        {isConfection && (
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-2xs">
            Raiz
          </span>
        )}
      </div>

      {/* Corpo do Nó */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <h4 className="text-xs font-bold text-slate-900 leading-snug break-words">
            {data.label || 'Local não definido'}
          </h4>
          <span className="font-mono text-[10px] text-slate-400">
            {data.code || 'sem_codigo'}
          </span>
        </div>

        {/* Indicadores de Campos e Regras */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold">
            <Tag className={`h-3.5 w-3.5 ${theme.accentText}`} />
            <span>
              {data.fieldsCount} {data.fieldsCount === 1 ? 'campo' : 'campos'}
            </span>
          </div>

          {data.instructions && (
            <span
              className="truncate text-[10px] text-slate-400 max-w-[110px]"
              title={data.instructions}
            >
              com instruções
            </span>
          )}
        </div>

        {/* Barra de Ações Rápidas no Próprio Nó */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onConfigure?.(id);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition ${theme.pillButtonHover}`}
            title="Configurar Campos e Instruções deste Nó"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onAddChild?.(id);
            }}
            className="flex items-center justify-center rounded-xl bg-blue-50 p-1.5 text-blue-600 transition hover:bg-blue-600 hover:text-white"
            title="Adicionar Etapa Filha conectada a esta"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {isConfection ? (
            <div
              className="flex items-center justify-center rounded-xl bg-amber-50 px-2.5 py-1.5 text-amber-800 font-bold text-[10px] border border-amber-200"
              title="Ponto de Partida Obrigatório (Protegido contra exclusão)"
            >
              <Lock className="h-3 w-3 mr-1" />
              Início
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.(id);
              }}
              className="flex items-center justify-center rounded-xl bg-rose-50 p-1.5 text-rose-500 transition hover:bg-rose-600 hover:text-white"
              title="Remover este Nó da Árvore"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

WorkflowCustomNode.displayName = 'WorkflowCustomNode';
