import React, { useState, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { X, Trash2, ArrowRight } from 'lucide-react';

export interface WorkflowCustomEdgeData extends Record<string, unknown> {
  onDeleteEdge?: (id: string) => void;
  isHomologated?: boolean;
}

/**
 * Calcula o ângulo da tangente do caminho no ponto médio (labelX, labelY) da aresta.
 * Analisa os comandos do SVG path (M, L, Q) gerados pelo getSmoothStepPath e encontra
 * o vetor de deslocamento (dx, dy) do segmento mais próximo para rotacionar a seta indicativa
 * na exata direção em que o fluxo está se movendo (0° para direita, 90° para baixo, etc.).
 */
export function getPathAngleAtPoint(pathStr: string, labelX: number, labelY: number): number {
  if (!pathStr) return 0;

  const matches = [...pathStr.matchAll(/([MLQ])\s*([-\d.]+)[,\s]+([-\d.]+)(?:[,\s]+([-\d.]+)[,\s]+([-\d.]+))?/g)];
  const points: { x: number; y: number }[] = [];

  for (const m of matches) {
    if (m[1] === 'Q' && m[4] != null && m[5] != null) {
      points.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) });
      points.push({ x: parseFloat(m[4]), y: parseFloat(m[5]) });
    } else {
      points.push({ x: parseFloat(m[2]), y: parseFloat(m[3]) });
    }
  }

  if (points.length < 2) return 0;

  let bestDist = Infinity;
  let bestAngle = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) continue;

    const t = Math.max(0, Math.min(1, ((labelX - p1.x) * dx + (labelY - p1.y) * dy) / lenSq));
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    const distSq = (labelX - projX) * (labelX - projX) + (labelY - projY) * (labelY - projY);

    if (distSq < bestDist) {
      bestDist = distSq;
      bestAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    }
  }

  return bestAngle;
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

  // Traçado ortogonal angulado com cantos suavizados (borderRadius: 8)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
    borderRadius: 8,
  });

  // Cálculo da orientação angular exata da seta indicativa no ponto médio da conexão
  const midAngle = useMemo(
    () => getPathAngleAtPoint(edgePath, labelX, labelY),
    [edgePath, labelX, labelY]
  );

  const edgeData = data as WorkflowCustomEdgeData | undefined;
  const isHomologated = Boolean(edgeData?.isHomologated);
  const onDelete = edgeData?.onDeleteEdge;
  // A exclusão só é permitida e visível se a árvore NÃO estiver homologada (em criação)
  const canDelete = !isHomologated && typeof onDelete === 'function';

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

      {/* Linha visível principal da conexão com estética angulada */}
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

      {/* Elemento Central: Indicador Direcional (Seta) e Botão de Exclusão (X) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: canDelete ? 'all' : 'none',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {canDelete ? (
            /* Em Criação: Pill com Seta Direcional do Fluxo + Botão X SEMPRE VISÍVEL */
            <div
              className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 shadow-md border transition-all duration-150 ${
                selected
                  ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/50'
                  : isHovered
                  ? 'border-indigo-400 ring-2 ring-indigo-100'
                  : 'border-slate-300'
              }`}
            >
              {/* Indicativo em Formato de Seta apontando na direção do fluxo */}
              <div
                className="flex h-3.5 w-3.5 items-center justify-center text-indigo-600 shrink-0"
                style={{ transform: `rotate(${midAngle}deg)` }}
                title={`Direção do fluxo (${Math.round(midAngle)}°)`}
              >
                <ArrowRight className="h-3.5 w-3.5 stroke-[2.75]" />
              </div>

              {/* Separador sutil */}
              <div className="h-3 w-px bg-slate-200 shrink-0" />

              {/* Botão de Excluir Conexão sempre visível na criação */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(id);
                }}
                title="Excluir esta conexão (ou selecione e pressione Delete/Backspace)"
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600 active:scale-95 transition-colors cursor-pointer"
              >
                {selected ? (
                  <Trash2 className="h-3 w-3 stroke-[2.5] text-rose-600" />
                ) : (
                  <X className="h-3 w-3 stroke-[3]" />
                )}
              </button>
            </div>
          ) : (
            /* Árvore Homologada: Apenas Seta Indicativa Central (sem botão X e sem exclusão) */
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-xs border border-indigo-200 text-indigo-600"
              title="Direção do fluxo desta etapa"
            >
              <div
                className="flex items-center justify-center"
                style={{ transform: `rotate(${midAngle}deg)` }}
              >
                <ArrowRight className="h-3 w-3 stroke-[2.75]" />
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
};
