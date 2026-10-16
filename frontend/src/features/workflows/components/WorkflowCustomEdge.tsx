import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { X, Trash2 } from 'lucide-react';

export interface WorkflowCustomEdgeData extends Record<string, unknown> {
  onDeleteEdge?: (id: string) => void;
}

export const WorkflowCustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  const onDelete = (data as WorkflowCustomEdgeData | undefined)?.onDeleteEdge;
  const isInteractive = Boolean(selected || isHovered);

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group cursor-pointer"
    >
      {/* Linha invisível mais espessa para facilitar o clique / seleção da aresta */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="cursor-pointer"
      />

      {/* Linha visível principal da conexão */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? '#ef4444' : isHovered ? '#6366f1' : (style.stroke || '#4f46e5'),
          strokeWidth: selected ? 2.5 : isHovered ? 2.5 : 2,
          strokeDasharray: selected ? '4,4' : undefined,
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
        markerEnd={markerEnd}
      />

      {/* Botão de Excluir Conexão renderizado no ponto médio da aresta */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isInteractive && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              title="Excluir esta conexão (ou selecione e pressione Delete/Backspace)"
              className={`flex items-center justify-center rounded-full shadow-md transition-all duration-150 ring-2 ring-white ${
                selected
                  ? 'h-6 w-6 bg-rose-600 text-white hover:bg-rose-700 hover:scale-110 active:scale-95'
                  : 'h-5 w-5 bg-slate-700 text-white hover:bg-rose-600 hover:scale-110'
              }`}
            >
              {selected ? (
                <Trash2 className="h-3 w-3 stroke-[2.5]" />
              ) : (
                <X className="h-3 w-3 stroke-[3]" />
              )}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
};
