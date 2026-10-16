import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus,
  Search,
  Inbox,
  ArrowUpRight,
  Building,
  User,
  Edit3,
  RefreshCw,
  Calendar,
  X,
  CheckCircle2,
  XCircle,
  Ban,
  MapPin,
} from 'lucide-react';
import { SelectDropdown } from '../../../shared/components/SelectDropdown';
import type { ProcessInstanceSummary } from '../types';
import { ProcessStatus } from '../types';

interface ProcessInboxTabProps {
  areaId?: string;
  processes: ProcessInstanceSummary[];
  onRefresh: () => void;
  onOpenNewProcess: () => void;
  canHandle: boolean;
}

function normalizeStatusKey(status: unknown): string {
  if (status === ProcessStatus.Draft || status === 'Draft' || status === 1) return 'draft';
  if (status === ProcessStatus.InReview || status === 'InReview' || status === 2) return 'in_review';
  if (status === ProcessStatus.Returned || status === 'Returned' || status === 3) return 'returned';
  if (status === ProcessStatus.Approved || status === 'Approved' || status === 4) return 'approved';
  if (status === ProcessStatus.Rejected || status === 'Rejected' || status === 5) return 'rejected';
  if (status === ProcessStatus.Finished || status === 'Finished' || status === 6) return 'finished';
  if (
    status === ProcessStatus.AdministrativeCancellation ||
    status === 'AdministrativeCancellation' ||
    status === 7
  )
    return 'cancelled';
  return 'in_review';
}

export const ProcessInboxTab: React.FC<ProcessInboxTabProps> = ({
  processes,
  onRefresh,
  onOpenNewProcess,
  canHandle,
}) => {
  const navigate = useNavigate();

  // Estados do Localizador de Processos (Search & Filters)
  const [codeFilter, setCodeFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Lista dinâmica de unidades presentes nos processos (Origem e Atual) + unidades padrão
  const availableUnitOptions = useMemo(() => {
    const unitNames = new Set<string>();
    processes.forEach((p) => {
      if (p.originUnitName) unitNames.add(p.originUnitName);
      if (p.currentUnitName) unitNames.add(p.currentUnitName);
    });
    const sorted = Array.from(unitNames).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return [
      { value: 'all', label: 'Todas as Unidades (Origem / Atual)' },
      ...sorted.map((name) => ({ value: name, label: name })),
    ];
  }, [processes]);

  const statusOptions = [
    { value: 'all', label: 'Todos os Status' },
    { value: 'in_review', label: 'Em Andamento / Em Análise' },
    { value: 'approved', label: 'Deferido (Aprovado)' },
    { value: 'rejected', label: 'Indeferido (Reprovado)' },
    { value: 'cancelled', label: 'Cancelado (Administrativo)' },
    { value: 'returned', label: 'Devolvido com Pendência' },
    { value: 'draft', label: 'Rascunho em Confecção' },
    { value: 'finished', label: 'Concluído / Arquivado' },
  ];

  const hasActiveFilters =
    codeFilter.trim() !== '' ||
    unitFilter !== 'all' ||
    statusFilter !== 'all' ||
    creatorFilter.trim() !== '' ||
    startDate !== '' ||
    endDate !== '';

  const handleClearFilters = () => {
    setCodeFilter('');
    setUnitFilter('all');
    setStatusFilter('all');
    setCreatorFilter('');
    setStartDate('');
    setEndDate('');
  };

  const filteredProcesses = useMemo(() => {
    return processes.filter((p) => {
      // 1. Filtro por Código / Identificador ou Título/Árvore
      if (codeFilter.trim()) {
        const term = codeFilter.trim().toLowerCase().replace(/^#/, '');
        const matchesCode =
          p.processNumber.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          p.processTypeName.toLowerCase().includes(term) ||
          (p.title && p.title.toLowerCase().includes(term));
        if (!matchesCode) return false;
      }

      // 2. Filtro por Unidade Atual ou Unidade de Origem
      if (unitFilter !== 'all') {
        const uNorm = unitFilter.toLowerCase();
        const matchesOrigin = (p.originUnitName || '').toLowerCase() === uNorm;
        const matchesCurrent = (p.currentUnitName || '').toLowerCase() === uNorm;
        if (!matchesOrigin && !matchesCurrent) return false;
      }

      // 3. Filtro por Status Atual
      if (statusFilter !== 'all') {
        const pStatusKey = normalizeStatusKey(p.status);
        if (pStatusKey !== statusFilter) return false;
      }

      // 4. Filtro por Usuário Criador / Solicitante / Abertura
      if (creatorFilter.trim()) {
        const cTerm = creatorFilter.trim().toLowerCase();
        const matchesCreator =
          (p.createdByUserName && p.createdByUserName.toLowerCase().includes(cTerm)) ||
          (p.openedByUserName && p.openedByUserName.toLowerCase().includes(cTerm));
        if (!matchesCreator) return false;
      }

      // 5. Filtro por Intervalo de Datas de Abertura (ou Criação)
      const refDateStr = p.openedAt || p.createdAt;
      if (startDate && refDateStr) {
        const procDate = new Date(refDateStr);
        const start = new Date(`${startDate}T00:00:00`);
        if (procDate < start) return false;
      }
      if (endDate && refDateStr) {
        const procDate = new Date(refDateStr);
        const end = new Date(`${endDate}T23:59:59.999`);
        if (procDate > end) return false;
      }

      return true;
    });
  }, [processes, codeFilter, unitFilter, statusFilter, creatorFilter, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-600" />
            Central & Localizador de Processos da Área
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pesquise solicitações por código, unidade atual/origem, status, solicitante ou período de abertura.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenNewProcess}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + Abrir Novo Processo
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LOCALIZADOR DE PROCESSOS (SEARCH & FILTERS)                               */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-indigo-600" />
            Localizador de Processos (Filtros Combinados)
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 px-2.5 py-1 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar Filtros ({filteredProcesses.length} de {processes.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 1. Código / Protocolo / Árvore */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Código / Protocolo ou Árvore
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                placeholder="Ex: #1, Contratação..."
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
              />
            </div>
          </div>

          {/* 2. Unidade Atual / Origem */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Unidade Atual / Unidade de Origem
            </label>
            <SelectDropdown
              value={unitFilter}
              onChange={(val) => setUnitFilter(val)}
              options={availableUnitOptions}
              placeholder="Todas as Unidades"
            />
          </div>

          {/* 3. Status Atual */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Status do Processo
            </label>
            <SelectDropdown
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={statusOptions}
              placeholder="Todos os Status"
            />
          </div>

          {/* 4. Usuário Criador / Solicitante */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Usuário Criador / Solicitante
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
                placeholder="Filtrar por nome do solicitante..."
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
              />
            </div>
          </div>

          {/* 5. Data Inicial de Abertura */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Abertura (De)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
            />
          </div>

          {/* 6. Data Final de Abertura */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Abertura (Até)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* TABELA DE PROCESSOS DA ÁREA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nº do Processo</th>
                <th className="py-3.5 px-4">Tipo de Processo (Árvore)</th>
                <th className="py-3.5 px-4">Etapa Atual & Status</th>
                <th className="py-3.5 px-4">Unidade (Origem / Atual)</th>
                <th className="py-3.5 px-4">Solicitante / Abertura</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProcesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum processo encontrado para os filtros informados.
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => {
                  const sKey = normalizeStatusKey(p.status);
                  const isDraft = sKey === 'draft';
                  const isApproved = sKey === 'approved';
                  const isRejected = sKey === 'rejected';
                  const isCancelled = sKey === 'cancelled';
                  const isFinished = sKey === 'finished';
                  const isReturned = sKey === 'returned';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Nº do Processo */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 text-xs">
                          {p.processNumber.startsWith('#') ? p.processNumber : `#${p.processNumber}`}
                        </span>
                      </td>

                      {/* Tipo de Processo (Árvore) */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 text-xs">
                          {p.processTypeName}
                        </div>
                        {p.title && p.title !== p.processTypeName && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {p.title}
                          </div>
                        )}
                      </td>

                      {/* Etapa Atual & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isDraft
                                ? 'bg-amber-500'
                                : isApproved
                                ? 'bg-emerald-500'
                                : isRejected || isCancelled
                                ? 'bg-rose-500'
                                : 'bg-indigo-500'
                            }`}
                          />
                          <span className="font-semibold text-slate-800 text-xs">
                            {p.currentNodeName}
                          </span>
                        </div>
                        <div className="mt-1">
                          {isDraft ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Rascunho
                            </span>
                          ) : isApproved ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Deferido
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Indeferido
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-900 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                              <Ban className="w-3 h-3 text-rose-700" />
                              Cancelado
                            </span>
                          ) : isFinished ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300">
                              Concluído
                            </span>
                          ) : isReturned ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Devolvido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              Em Andamento
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unidade (Origem / Atual) */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{p.currentUnitName || p.originUnitName || 'Sede'}</span>
                        </div>
                        {p.originUnitName && p.currentUnitName && p.originUnitName !== p.currentUnitName && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Origem: {p.originUnitName}</span>
                          </div>
                        )}
                      </td>

                      {/* Solicitante & Data */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-medium text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.createdByUserName || 'Solicitante'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {new Date(p.openedAt || p.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      {/* Ações Rápidas */}
                      <td className="py-3.5 px-4 text-right">
                        {isDraft ? (
                          <button
                            onClick={() => navigate(`/app/workflows/processes/${p.id}/confection`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl transition-colors border border-amber-200 shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Continuar Rascunho
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/app/workflows/processes/${p.id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors border border-indigo-200"
                          >
                            {canHandle ? 'Tramitar / Ver' : 'Ver Detalhes'}
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
    </div>
  );
};
