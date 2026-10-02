import React from 'react';
import { Plus, Edit2, Trash2, GitCommit, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ProcessNode } from '../types';
import { ProcessNodeType } from '../types';
import * as workflowsApi from '../api';

interface ProcessNodesCatalogTabProps {
  areaId: string;
  nodes: ProcessNode[];
  onRefresh: () => void;
  canManage: boolean;
}

const NODE_TYPE_LABELS: Record<number, { label: string; badgeClass: string }> = {
  [ProcessNodeType.StartConfection]: {
    label: 'Ponto de Partida / Confecção',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  [ProcessNodeType.StandardStage]: {
    label: 'Etapa Padrão de Análise',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  [ProcessNodeType.ApprovalStage]: {
    label: 'Etapa de Aprovação',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  [ProcessNodeType.EndArchived]: {
    label: 'Conclusão / Arquivamento',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export const ProcessNodesCatalogTab: React.FC<ProcessNodesCatalogTabProps> = ({
  areaId,
  nodes,
  onRefresh,
  canManage,
}) => {
  const navigate = useNavigate();

  const handleOpenCreate = () => {
    navigate(`/app/workflows/nodes/new?areaId=${areaId}`);
  };

  const handleOpenEdit = (node: ProcessNode) => {
    navigate(`/app/workflows/nodes/${node.id}?areaId=${areaId}`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente desativar o local de processo "${name}"?`)) return;
    try {
      await workflowsApi.deleteNode(id);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Erro ao desativar local de processo.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-indigo-600" />
            Catálogo de Locais de Processos (Nodos Reutilizáveis)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Etapas e estações de tramitação cadastradas na área. Eles podem ser adicionados e conectados em qualquer tipo de processo (árvore).
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Novo Local de Processo
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nome do Local</th>
                <th className="py-3 px-4">Classificação / Tipo</th>
                <th className="py-3 px-4">Descrição das Atribuições</th>
                <th className="py-3 px-4">Status</th>
                {canManage && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400">
                    Nenhum local de processo cadastrado nesta área até o momento.
                  </td>
                </tr>
              ) : (
                nodes.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 text-xs">
                      {n.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 text-xs">
                      {n.name}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          NODE_TYPE_LABELS[n.nodeType]?.badgeClass || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {NODE_TYPE_LABELS[n.nodeType]?.label || 'Etapa Padrão'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">
                      {n.description || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {n.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                          <X className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(n)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar Local na Página Dedicada"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(n.id, n.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Desativar Local"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
