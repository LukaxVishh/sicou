import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search, Filter, Inbox, ArrowUpRight, Building, User, Edit3 } from 'lucide-react';
import type { ProcessInstanceSummary } from '../types';
import { ProcessStatus } from '../types';
import { ProcessDetailsDrawer } from './ProcessDetailsDrawer';

interface ProcessInboxTabProps {
  areaId?: string;
  processes: ProcessInstanceSummary[];
  onRefresh: () => void;
  onOpenNewProcess: () => void;
  canHandle: boolean;
}

export const ProcessInboxTab: React.FC<ProcessInboxTabProps> = ({
  processes,
  onRefresh,
  onOpenNewProcess,
  canHandle,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  const filteredProcesses = processes.filter((p) => {
    const matchesSearch =
      p.processNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.processTypeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.createdByUserName && p.createdByUserName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.originUnitName && p.originUnitName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'draft') return p.status === ProcessStatus.Draft;
    if (statusFilter === 'review') return p.status === ProcessStatus.InReview;
    if (statusFilter === 'returned') return p.status === ProcessStatus.Returned;
    if (statusFilter === 'finished') return p.status === ProcessStatus.Finished;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-600" />
            Central de Processos Abertos da Área
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Fila operacional de solicitações e chamados que estão tramitando nos locais de processo desta área.
          </p>
        </div>
        <button
          onClick={onOpenNewProcess}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          + Abrir Novo Processo
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por protocolo, árvore ou solicitante..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Status</option>
            <option value="draft">Rascunhos em Confecção</option>
            <option value="review">Em Análise / Tramitação</option>
            <option value="returned">Devolvidos com Pendência</option>
            <option value="finished">Concluídos</option>
          </select>
        </div>
      </div>

      {/* TABELA DE PROCESSOS DA ÁREA (Conforme especificação do usuário) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Nº do Processo</th>
                <th className="py-3 px-4">Tipo de Processo (Árvore)</th>
                <th className="py-3 px-4">Local Atual (Instância / Nodo)</th>
                <th className="py-3 px-4">Solicitante / Origem</th>
                <th className="py-3 px-4">Data de Abertura</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProcesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Nenhum processo encontrado na fila desta área.
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => {
                  const isDraft = p.status === ProcessStatus.Draft;
                  const isFinished = p.status === ProcessStatus.Finished;
                  const isReturned = p.status === ProcessStatus.Returned;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Nº do Processo */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100 text-xs">
                          {p.processNumber.startsWith('#') ? p.processNumber : `Processo #${p.processNumber}`}
                        </span>
                      </td>

                      {/* Tipo de Processo (Árvore) */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 text-xs">
                          {p.processTypeName}
                        </div>
                        {p.title && p.title !== p.processTypeName && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {p.title}
                          </div>
                        )}
                      </td>

                      {/* Local Atual (Instância / Nodo) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isDraft ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                          <span className="font-semibold text-slate-800 text-xs">
                            {p.currentNodeName}
                          </span>
                        </div>
                        <div className="mt-0.5">
                          {isDraft ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Rascunho
                            </span>
                          ) : isFinished ? (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              Concluído
                            </span>
                          ) : isReturned ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Devolvido
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Em Análise
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Solicitante / Origem */}
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-medium text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {p.createdByUserName || 'Solicitante'}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {p.originUnitName || 'Sede'}
                        </div>
                      </td>

                      {/* Data de Abertura */}
                      <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                        {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Ações Rápidas */}
                      <td className="py-3 px-4 text-right">
                        {isDraft ? (
                          <button
                            onClick={() => navigate(`/app/workflows/processes/${p.id}/confection`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg transition-colors border border-amber-200 shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Continuar Preenchimento
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedProcessId(p.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition-colors border border-indigo-200"
                          >
                            {canHandle ? 'Tramitar' : 'Ver Detalhes'}
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer de Detalhes e Tramitação */}
      {selectedProcessId && (
        <ProcessDetailsDrawer
          processId={selectedProcessId}
          onClose={() => setSelectedProcessId(null)}
          onRefresh={onRefresh}
          canHandle={canHandle}
        />
      )}
    </div>
  );
};
