import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  Sparkles,
  Layers,
  FileCheck2,
  CheckCircle2,
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

const NODE_THEMES: Record<
  number,
  {
    headerBg: string;
    borderClass: string;
    icon: React.ElementType;
    badgeText: string;
    badgeColor: string;
  }
> = {
  [ProcessNodeType.StartConfection]: {
    headerBg: 'bg-emerald-600',
    borderClass: 'border-emerald-500 hover:border-emerald-600',
    icon: Sparkles,
    badgeText: 'Ponto de Partida',
    badgeColor: 'bg-emerald-100 text-emerald-800',
  },
  [ProcessNodeType.StandardStage]: {
    headerBg: 'bg-indigo-600',
    borderClass: 'border-indigo-400 hover:border-indigo-600',
    icon: Layers,
    badgeText: 'Tramitação / Análise',
    badgeColor: 'bg-indigo-100 text-indigo-800',
  },
  [ProcessNodeType.ApprovalStage]: {
    headerBg: 'bg-amber-600',
    borderClass: 'border-amber-400 hover:border-amber-600',
    icon: FileCheck2,
    badgeText: 'Decisão / Parecer',
    badgeColor: 'bg-amber-100 text-amber-800',
  },
  [ProcessNodeType.EndArchived]: {
    headerBg: 'bg-slate-700',
    borderClass: 'border-slate-500 hover:border-slate-700',
    icon: CheckCircle2,
    badgeText: 'Arquivamento',
    badgeColor: 'bg-slate-100 text-slate-800',
  },
};

export const WorkflowCustomNode = memo(({ id, data, selected }: NodeProps<WorkflowNodeType>) => {
  const theme = NODE_THEMES[data.nodeType] || NODE_THEMES[ProcessNodeType.StandardStage];
  const Icon = theme.icon;
  const isConfection = data.isStart || data.nodeType === ProcessNodeType.StartConfection;

  return (
    <div
      className={`group relative min-w-[240px] max-w-[280px] rounded-2xl bg-white shadow-md transition-all duration-200 ${
        theme.borderClass
      } ${
        selected
          ? 'ring-3 ring-indigo-500/50 shadow-xl scale-[1.02]'
          : 'ring-1 ring-slate-200 hover:shadow-lg'
      }`}
    >
      {/* Handles para conexões nos 4 eixos */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-indigo-600 transition hover:!scale-125"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-indigo-600 transition hover:!scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-indigo-600 transition hover:!scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-indigo-600 transition hover:!scale-125"
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
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">
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
            <Tag className="h-3.5 w-3.5 text-indigo-500" />
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
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
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
            className="flex items-center justify-center rounded-xl bg-indigo-50 p-1.5 text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
            title="Adicionar Etapa Filha conectada a esta"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {isConfection ? (
            <div
              className="flex items-center justify-center rounded-xl bg-emerald-50 px-2.5 py-1.5 text-emerald-700 font-bold text-[10px] border border-emerald-200"
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
