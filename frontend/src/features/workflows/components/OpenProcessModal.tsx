import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { X, ArrowRight, AlertCircle, FileText, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ProcessTypeSummary } from '../types';
import { isDraftStatus, isHomologatedStatus } from '../types';
import * as workflowsApi from '../api';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';

interface OpenProcessModalProps {
  onClose: () => void;
  onCreated?: (newProcessId: string) => void;
}

export const OpenProcessModal: React.FC<OpenProcessModalProps> = ({
  onClose,
  onCreated,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;
  const isCompanyAdmin = user?.roles.includes(SystemRoles.CompanyAdmin) ?? false;

  const [availableTypes, setAvailableTypes] = useState<ProcessTypeSummary[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [selectedVersionChoice, setSelectedVersionChoice] = useState<'homologated' | 'draft'>('homologated');
  
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAvailable() {
      setTypesLoading(true);
      try {
        const data = await workflowsApi.getAvailableProcessTypes();
        setAvailableTypes(data);

        // Agrupar por família para selecionar o primeiro por padrão
        if (data.length > 0) {
          const firstFamily = data[0].familyId || data[0].id;
          setSelectedFamilyId(firstFamily);
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar árvores de processos disponíveis.');
      } finally {
        setTypesLoading(false);
      }
    }
    loadAvailable();
  }, []);

  // Agrupamento por Família
  const familyGroups = useMemo(() => {
    const map = new Map<string, {
      familyId: string;
      name: string;
      code: string;
      areaName: string;
      homologated?: ProcessTypeSummary;
      draft?: ProcessTypeSummary;
      all: ProcessTypeSummary[];
    }>();

    availableTypes.forEach((t) => {
      const famId = t.familyId || t.id;
      if (!map.has(famId)) {
        map.set(famId, {
          familyId: famId,
          name: t.name,
          code: t.code,
          areaName: t.areaName,
          all: [],
        });
      }
      const group = map.get(famId)!;
      group.all.push(t);

      if (isHomologatedStatus(t.status)) {
        if (!group.homologated || t.versionNumber > group.homologated.versionNumber) {
          group.homologated = t;
        }
      } else if (isDraftStatus(t.status)) {
        group.draft = t;
      }
    });

    return Array.from(map.values());
  }, [availableTypes]);

  // Família selecionada
  const currentGroup = useMemo(() => {
    return familyGroups.find((g) => g.familyId === selectedFamilyId) || familyGroups[0] || null;
  }, [familyGroups, selectedFamilyId]);

  // Se o grupo não tiver versão homologada mas tiver draft (ou vice-versa), ajusta a escolha
  useEffect(() => {
    if (!currentGroup) return;

    const hasHomologated = !!currentGroup.homologated;
    const hasDraft = !!currentGroup.draft;

    if (!hasHomologated && hasDraft && (isSuperAdmin || isCompanyAdmin)) {
      setSelectedVersionChoice('draft');
    } else if (hasHomologated && !hasDraft) {
      setSelectedVersionChoice('homologated');
    }
  }, [currentGroup, isSuperAdmin, isCompanyAdmin]);

  // Tipo de processo exato selecionado
  const selectedProcessType = useMemo(() => {
    if (!currentGroup) return null;
    if (selectedVersionChoice === 'draft' && currentGroup.draft) {
      return currentGroup.draft;
    }
    return currentGroup.homologated || currentGroup.draft || currentGroup.all[0] || null;
  }, [currentGroup, selectedVersionChoice]);

  const handleStartProcess = async () => {
    if (!selectedProcessType) return;
    setError(null);
    setLoading(true);

    try {
      // Cria a instância inicial como Rascunho
      const created = await workflowsApi.createProcess({
        processTypeId: selectedProcessType.id,
        isDraft: true,
      });

      if (onCreated) {
        onCreated(created.id);
      }

      // Redireciona para a página dedicada de confecção do processo
      navigate(`/app/workflows/processes/${created.id}/confection`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao iniciar o processo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Abertura de Processo
            </h3>
            <p className="text-xs text-slate-500">
              Selecione o fluxo desejado para iniciar a confecção da solicitação.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {typesLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Carregando árvores de processos disponíveis...
            </div>
          ) : familyGroups.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
              <p className="font-bold">Nenhum processo homologado disponível</p>
              <p className="text-amber-700">
                Não há árvores de processos ativas disponíveis para abertura na sua unidade/área no momento.
              </p>
            </div>
          ) : (
            <>
              {/* Dropdown com Árvores da Área */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Árvore de Processo / Serviço *
                </label>
                <select
                  value={selectedFamilyId}
                  onChange={(e) => setSelectedFamilyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                  {familyGroups.map((g) => (
                    <option key={g.familyId} value={g.familyId}>
                      [{g.areaName}] {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seletor de Versão para Administradores */}
              {(isSuperAdmin || isCompanyAdmin) && currentGroup && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-600">
                    Versão de Execução (Controle de Administrador):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Opção Vigente */}
                    <button
                      type="button"
                      disabled={!currentGroup.homologated}
                      onClick={() => setSelectedVersionChoice('homologated')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        selectedVersionChoice === 'homologated' && currentGroup.homologated
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      } ${!currentGroup.homologated ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          {currentGroup.homologated
                            ? `Versão Homologada (v${currentGroup.homologated.versionNumber})`
                            : 'Homologada (Indisponível)'}
                        </span>
                        {selectedVersionChoice === 'homologated' && currentGroup.homologated && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1">
                        Versão oficial e ativa utilizada pelas unidades.
                      </span>
                    </button>

                    {/* Opção Em Criação / Rascunho */}
                    <button
                      type="button"
                      disabled={!currentGroup.draft}
                      onClick={() => setSelectedVersionChoice('draft')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        selectedVersionChoice === 'draft' && currentGroup.draft
                          ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      } ${!currentGroup.draft ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900">
                          {currentGroup.draft
                            ? `Em Criação (v${currentGroup.draft.versionNumber})`
                            : 'Em Criação (Nenhuma)'}
                        </span>
                        {selectedVersionChoice === 'draft' && currentGroup.draft && (
                          <Sparkles className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <span className="text-[11px] text-amber-800/80 mt-1">
                        Rascunho para testes antes da homologação.
                      </span>
                    </button>
                  </div>

                  {selectedVersionChoice === 'draft' && currentGroup.draft && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Você está iniciando em modo de teste com a árvore em criação (v{currentGroup.draft.versionNumber}).
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Informação sobre o Processo Selecionado */}
              {selectedProcessType && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span>{selectedProcessType.name}</span>
                    <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      v{selectedProcessType.versionNumber}
                    </span>
                  </div>
                  {selectedProcessType.description && (
                    <p className="text-slate-500">{selectedProcessType.description}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStartProcess}
            disabled={loading || !selectedProcessType || familyGroups.length === 0}
            className="px-5 py-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              'Iniciando...'
            ) : (
              <>
                <span>Iniciar Processo</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
