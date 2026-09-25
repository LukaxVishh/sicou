import React, { useState } from 'react';
import { Plus, Edit2, Trash2, GitCommit, Check, X, AlertCircle } from 'lucide-react';
import type { ProcessNode, CreateProcessNodePayload, UpdateProcessNodePayload } from '../types';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<ProcessNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodeType, setNodeType] = useState<number>(ProcessNodeType.StandardStage);

  const openCreateModal = () => {
    setEditingNode(null);
    setCode('');
    setName('');
    setDescription('');
    setNodeType(ProcessNodeType.StandardStage);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (node: ProcessNode) => {
    setEditingNode(node);
    setCode(node.code);
    setName(node.name);
    setDescription(node.description || '');
    setNodeType(node.nodeType);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (editingNode) {
        const payload: UpdateProcessNodePayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          nodeType: nodeType as any,
          isActive: editingNode.isActive,
        };
        await workflowsApi.updateNode(editingNode.id, payload);
      } else {
        const payload: CreateProcessNodePayload = {
          code: code.trim().toLowerCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          nodeType: nodeType as any,
        };
        await workflowsApi.createNode(areaId, payload);
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar local de processo.');
    } finally {
      setLoading(false);
    }
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
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
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
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {n.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {n.name}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
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
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                          <X className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(n)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Editar Local"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(n.id, n.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
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

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">
                {editingNode ? 'Editar Local de Processo' : 'Novo Local de Processo'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Código do Local *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingNode}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ex: confeccao_solicitante"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome do Local *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Ponto de Partida / Confecção"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Classificação / Tipo do Local *
                </label>
                <select
                  value={nodeType}
                  onChange={(e) => setNodeType(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Object.entries(NODE_TYPE_LABELS).map(([val, item]) => (
                    <option key={val} value={val}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Descrição das Atribuições
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instruções para o operador responsável neste local..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Local'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
