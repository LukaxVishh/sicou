import React, { useState, useEffect } from 'react';
import { X, ArrowRight, CornerUpLeft, RotateCcw, MessageSquare, Clock, User, Building, AlertCircle } from 'lucide-react';
import type { ProcessInstance } from '../types';
import { ProcessStatus, ProcessActionType } from '../types';
import * as workflowsApi from '../api';

interface ProcessDetailsDrawerProps {
  processId: string;
  onClose: () => void;
  onRefresh: () => void;
  canHandle: boolean;
}

export const ProcessDetailsDrawer: React.FC<ProcessDetailsDrawerProps> = ({
  processId,
  onClose,
  onRefresh,
  canHandle,
}) => {
  const [instance, setInstance] = useState<ProcessInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de ações de tramitação
  const [actionType, setActionType] = useState<'advance' | 'return' | 'restart' | 'comment' | null>(null);
  const [observations, setObservations] = useState('');
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await workflowsApi.getProcessById(processId);
      setInstance(data);
      // Preencher valores atuais dos campos editáveis
      const vals: Record<string, string> = {};
      data.fieldValues.forEach((fv) => {
        vals[fv.fieldDefinitionId] = fv.value || '';
      });
      setFieldEdits(vals);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar detalhes do processo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [processId]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionType || !instance) return;
    setActionLoading(true);
    setError(null);

    try {
      if (actionType === 'advance') {
        await workflowsApi.advanceProcess(instance.id, {
          observations: observations.trim() || undefined,
          fieldValues: fieldEdits,
        });
      } else if (actionType === 'return') {
        if (!observations.trim()) throw new Error('A justificativa é obrigatória para devolver.');
        await workflowsApi.returnProcess(instance.id, {
          observations: observations.trim(),
        });
      } else if (actionType === 'restart') {
        if (!observations.trim()) throw new Error('A justificativa é obrigatória para reiniciar.');
        await workflowsApi.restartProcess(instance.id, {
          observations: observations.trim(),
        });
      } else if (actionType === 'comment') {
        if (!observations.trim()) throw new Error('O comentário é obrigatório.');
        await workflowsApi.addProcessComment(instance.id, {
          observations: observations.trim(),
        });
      }

      setActionType(null);
      setObservations('');
      await loadData();
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Erro ao tramitar processo.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header do Drawer */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                {instance?.processNumber || 'Processo'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700">
                {instance?.status === ProcessStatus.Finished ? 'Concluído' : instance?.status === ProcessStatus.Returned ? 'Devolvido' : 'Em Análise'}
              </span>
            </div>
            <h3 className="font-bold text-base text-slate-800 mt-1">
              {instance?.title || instance?.processTypeName}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Carregando detalhes...</div>
          ) : !instance ? (
            <div className="py-12 text-center text-slate-400 text-sm">Processo não encontrado.</div>
          ) : (
            <>
              {/* Card de Localização Atual */}
              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase text-indigo-600 tracking-wider block">
                    Localização Atual (Instância)
                  </span>
                  <h4 className="text-base font-bold text-slate-800 mt-0.5">
                    {instance.currentNodeName}
                  </h4>
                  <span className="text-xs text-slate-500">
                    Árvore: <strong>{instance.processTypeName}</strong> (v{instance.processTypeVersion})
                  </span>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div className="flex items-center gap-1 justify-end font-medium text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {instance.createdByUserName || 'Solicitante'}
                  </div>
                  <div className="flex items-center gap-1 justify-end text-[11px] text-slate-500 mt-0.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    {instance.originUnitName || 'Sede'}
                  </div>
                </div>
              </div>

              {/* Formulário com Dados Preenchidos */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Dados do Formulário do Processo
                </h5>
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-sm">
                  {instance.fieldValues.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400 text-center">
                      Nenhum campo com valor preenchido neste processo.
                    </div>
                  ) : (
                    instance.fieldValues.map((fv) => (
                      <div key={fv.fieldDefinitionId} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-700">
                          {fv.name}
                        </span>
                        <span className="font-medium text-slate-900 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                          {fv.value || '-'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Barra de Ações de Decisão (Avançar / Devolver / Reiniciar) */}
              {canHandle && instance.status !== ProcessStatus.Finished && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                    Decisão e Tramitação da Área
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => setActionType('advance')}
                      className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                        actionType === 'advance'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <ArrowRight className="w-4 h-4" />
                      Avançar Local
                    </button>

                    <button
                      onClick={() => setActionType('return')}
                      className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                        actionType === 'return'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      <CornerUpLeft className="w-4 h-4" />
                      Devolver
                    </button>

                    <button
                      onClick={() => setActionType('restart')}
                      className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                        actionType === 'restart'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reiniciar
                    </button>

                    <button
                      onClick={() => setActionType('comment')}
                      className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 border transition-all ${
                        actionType === 'comment'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Parecer
                    </button>
                  </div>

                  {actionType && (
                    <form onSubmit={handleExecuteAction} className="pt-3 border-t border-slate-200 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {actionType === 'advance'
                            ? 'Observações de Encaminhamento (Opcional)'
                            : actionType === 'return'
                            ? 'Motivo / Justificativa da Devolução *'
                            : actionType === 'restart'
                            ? 'Motivo do Reinício para Confecção *'
                            : 'Parecer / Despacho Técnico *'}
                        </label>
                        <textarea
                          required={actionType !== 'advance'}
                          rows={2}
                          value={observations}
                          onChange={(e) => setObservations(e.target.value)}
                          placeholder="Digite seu parecer ou justificativa..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActionType(null)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                        >
                          Cancelar Ação
                        </button>
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                        >
                          {actionLoading ? 'Processando...' : 'Confirmar Tramitação'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Histórico e Linha do Tempo */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Linha do Tempo e Histórico de Tramitação ({instance.history.length})
                </h5>

                <div className="border-l-2 border-indigo-200 ml-3 pl-4 space-y-4">
                  {instance.history.map((h) => (
                    <div key={h.id} className="relative">
                      <span className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span className="font-semibold text-slate-800">
                            {h.userFullName || 'Usuário'}
                          </span>
                          <span>{new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="text-indigo-700 font-medium">
                          {h.action === ProcessActionType.Advance && 'Avanço de Etapa'}
                          {h.action === ProcessActionType.Return && 'Devolução de Etapa'}
                          {h.action === ProcessActionType.Restart && 'Processo Reiniciado'}
                          {h.action === ProcessActionType.Comment && 'Parecer Registrado'}
                          {h.toNodeName && ` ➔ ${h.toNodeName}`}
                        </div>
                        {h.observations && (
                          <p className="text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1">
                            {h.observations}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
