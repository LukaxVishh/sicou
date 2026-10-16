import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CornerUpLeft,
  RotateCcw,
  Clock,
  Building,
  Building2,
  GitBranch,
  Hash,
  FileText,
  MapPin,
  AlertCircle,
  X,
  MessageSquare,
  Info,
  Layers,
  Lock,
  ShieldAlert,
  Search,
  Check,
  Ban,
  CheckCircle2,
  XCircle,
  Archive,
  UserCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { SelectDropdown } from '../../../shared/components/SelectDropdown';
import { getAccessesByUser } from '../../access-control/api';
import { getUnitsByCompanyId } from '../../units/api';
import type { Unit } from '../../units/types';
import * as workflowsApi from '../api';
import type {
  ProcessInstance,
  ProcessType,
  ProcessTypeField,
  NodeInstructionsConfig,
} from '../types';
import {
  ProcessStatus,
  ProcessActionType,
  ProcessNodeType,
  FieldType,
  isTerminalProcessStatus,
} from '../types';
import { evaluateFieldConditions } from '../utils/evaluateFieldConditions';

function isTransferAction(action: unknown): boolean {
  return action === ProcessActionType.Transfer || action === 6 || action === 'Transfer';
}

function isCancelAction(action: unknown): boolean {
  return action === ProcessActionType.Cancel || action === 5 || action === 'Cancel';
}

function isAdvanceAction(action: unknown): boolean {
  return action === ProcessActionType.Advance || action === 1 || action === 'Advance';
}

function isReturnAction(action: unknown): boolean {
  return action === ProcessActionType.Return || action === 2 || action === 'Return';
}

function isRestartAction(action: unknown): boolean {
  return action === ProcessActionType.Restart || action === 3 || action === 'Restart';
}

export const ProcessTrackingPage: React.FC = () => {
  const { id: processId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [instance, setInstance] = useState<ProcessInstance | null>(null);
  const [processType, setProcessType] = useState<ProcessType | null>(null);
  const [companyUnits, setCompanyUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permissão de Cancelamento Administrativo e Transferência
  const [canCancel, setCanCancel] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Modal de Transferência de Unidade / Lotação
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedTransferUnitId, setSelectedTransferUnitId] = useState('');
  const [transferObservations, setTransferObservations] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);

  // Modal "Dados do Processo"
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [fieldSearchTerm, setFieldSearchTerm] = useState('');

  // Modais de Ação de Tramitação
  const [activeActionModal, setActiveActionModal] = useState<'advance' | 'return' | 'restart' | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [opinionText, setOpinionText] = useState('');
  const [opinionError, setOpinionError] = useState<string | null>(null);
  const [stageFieldValues, setStageFieldValues] = useState<Record<string, string>>({});

  // Temporizador da Instância Atual (em segundos decorridos)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // 1. Carregar dados do Processo, da Árvore e das Unidades
  const loadProcessData = useCallback(async () => {
    if (!processId) return;
    setLoading(true);
    setError(null);

    try {
      const proc = await workflowsApi.getProcessById(processId);
      setInstance(proc);

      const [tree, unitsResult] = await Promise.all([
        workflowsApi.getProcessTypeById(proc.processTypeId),
        proc.companyId ? getUnitsByCompanyId(proc.companyId).catch(() => [] as Unit[]) : Promise.resolve([] as Unit[]),
      ]);

      setProcessType(tree);
      setCompanyUnits(unitsResult.filter((u) => u.isActive));

      // Avaliação de permissão para Cancelamento Administrativo:
      // Autor do processo OU Administradores da respectiva área / empresa / superadmin
      const isCreator = currentUser?.id === proc.createdByUserId;
      const isAdm =
        currentUser?.roles?.includes(SystemRoles.SuperAdmin) ||
        currentUser?.roles?.includes(SystemRoles.CompanyAdmin);

      if (isCreator || isAdm) {
        setCanCancel(true);
      } else if (currentUser?.id) {
        try {
          const userAccesses = await getAccessesByUser(currentUser.id);
          const hasAreaAdm = userAccesses.some(
            (a) =>
              a.areaId === proc.areaId &&
              a.isActive &&
              (a.canManage || a.canManageWorkflows)
          );
          setCanCancel(hasAreaAdm);
        } catch {
          setCanCancel(false);
        }
      } else {
        setCanCancel(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar detalhes do processo.');
    } finally {
      setLoading(false);
    }
  }, [processId, currentUser]);

  useEffect(() => {
    loadProcessData();
  }, [loadProcessData]);

  const handleOpenCancelModal = () => {
    setCancelReason('');
    setCancelError(null);
    setIsCancelModalOpen(true);
  };

  const handleExecuteCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instance) return;

    if (!cancelReason.trim() || cancelReason.trim().length < 5) {
      setCancelError('A justificativa do cancelamento deve conter no mínimo 5 caracteres.');
      return;
    }

    setCancelLoading(true);
    setCancelError(null);

    try {
      await workflowsApi.cancelProcess(instance.id, {
        reason: cancelReason.trim(),
      });
      setIsCancelModalOpen(false);
      setCancelReason('');
      await loadProcessData();
    } catch (err: any) {
      setCancelError(err?.message || 'Erro ao realizar o cancelamento administrativo.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleOpenTransferModal = () => {
    setSelectedTransferUnitId(instance?.currentUnitId || '');
    setTransferObservations('');
    setTransferError(null);
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instance) return;

    if (!selectedTransferUnitId) {
      setTransferError('Selecione a unidade/departamento de destino para a transferência.');
      return;
    }

    if (!transferObservations.trim()) {
      setTransferError('Informe o motivo ou despacho da transferência entre unidades.');
      return;
    }

    const chosenUnit = companyUnits.find((u) => u.id === selectedTransferUnitId);

    setTransferLoading(true);
    setTransferError(null);

    try {
      await workflowsApi.transferProcess(instance.id, {
        destinationUnitId: chosenUnit ? chosenUnit.id : undefined,
        destinationUnitName: chosenUnit ? chosenUnit.name : selectedTransferUnitId,
        observations: transferObservations.trim(),
      });
      setIsTransferModalOpen(false);
      setTransferObservations('');
      await loadProcessData();
    } catch (err: any) {
      setTransferError(err?.message || 'Erro ao transferir o processo de unidade.');
    } finally {
      setTransferLoading(false);
    }
  };

  // 2. Data de entrada na instância atual para o temporizador
  const currentInstanceEntryDate = useMemo(() => {
    if (!instance || !instance.history || instance.history.length === 0) {
      return instance ? new Date(instance.createdAt) : new Date();
    }
    const arrivalEvent = instance.history.find(
      (h) => h.toNodeId === instance.currentNodeId && !isTransferAction(h.action)
    );
    if (arrivalEvent) {
      return new Date(arrivalEvent.createdAt);
    }
    return instance.updatedAt ? new Date(instance.updatedAt) : new Date(instance.createdAt);
  }, [instance]);

  // Efeito do Temporizador (atualização a cada segundo)
  useEffect(() => {
    const updateTimer = () => {
      if (!currentInstanceEntryDate) return;
      const now = new Date();
      const diffMs = now.getTime() - currentInstanceEntryDate.getTime();
      const totalSec = Math.max(0, Math.floor(diffMs / 1000));
      setElapsedSeconds(totalSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentInstanceEntryDate]);

  // Decomposição do tempo decorrido em unidades
  const timeUnits = useMemo(() => {
    const days = Math.floor(elapsedSeconds / 86400);
    const hours = Math.floor((elapsedSeconds % 86400) / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return { days, hours, minutes, seconds };
  }, [elapsedSeconds]);

  // Transições válidas a partir do nó atual
  const availableAdvanceTransitions = useMemo(() => {
    if (!processType || !instance) return [];
    return processType.transitions.filter(
      (t) => t.fromNodeId === instance.currentNodeId && t.allowAdvance
    );
  }, [processType, instance]);

  const availableReturnTransitions = useMemo(() => {
    if (!processType || !instance) return [];
    return processType.transitions.filter(
      (t) => t.toNodeId === instance.currentNodeId && t.allowReturn
    );
  }, [processType, instance]);

  // Campos vinculados à etapa atual (para preenchimento na etapa de análise)
  const currentNodeFields = useMemo(() => {
    if (!processType || !instance) return [];
    return processType.fields
      .filter((f) => f.processNodeId === instance.currentNodeId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [processType, instance]);

  // Verifica se o nó de destino selecionado no avanço é um nó terminal de Indeferimento (EndRejected)
  const isTargetNodeRejected = useMemo(() => {
    if (!processType || !targetNodeId) return false;
    const targetNode = processType.nodes.find((n) => n.processNodeId === targetNodeId);
    if (!targetNode) return false;
    const nt = targetNode.nodeType as unknown;
    return (
      nt === ProcessNodeType.EndRejected ||
      nt === 'EndRejected' ||
      nt === 6
    );
  }, [processType, targetNodeId]);

  // Configuração do Nó Atual (Instruções e Parecer)
  const currentNodeConfig = useMemo((): NodeInstructionsConfig | null => {
    if (!processType || !instance) return null;
    const treeNode = processType.nodes.find(
      (n) => n.processNodeId === instance.currentNodeId
    );
    if (!treeNode || !treeNode.instructions) return null;

    try {
      const parsed: any = JSON.parse(treeNode.instructions);
      if (parsed.opinion && typeof parsed.opinion === 'object') {
        const req = parsed.opinion.hidden
          ? 'hidden'
          : parsed.opinion.required
          ? 'required'
          : 'optional';
        return {
          instructions: parsed.text || parsed.instructions || '',
          opinionConfig: { requirement: req },
        };
      }
      return parsed as NodeInstructionsConfig;
    } catch {
      return {
        instructions: treeNode.instructions,
        opinionConfig: { requirement: 'optional' as const },
      };
    }
  }, [processType, instance]);

  // Avaliação Dinâmica de Regras Condicionais para o Parecer
  const opinionRequirementEvaluated = useMemo(() => {
    if (activeActionModal === 'advance' && isTargetNodeRejected) {
      return 'required';
    }

    let requirement = currentNodeConfig?.opinionConfig?.requirement || 'optional';

    if (!processType || !instance || !currentNodeConfig) {
      return requirement;
    }

    const currentFormValues: Record<string, string> = {};
    instance.fieldValues.forEach((fv) => {
      currentFormValues[fv.fieldDefinitionId] = fv.value || '';
    });
    Object.entries(stageFieldValues).forEach(([k, v]) => {
      currentFormValues[k] = v;
    });

    for (const field of currentNodeFields) {
      if (field.conditionsJson) {
        const evaluated = evaluateFieldConditions(field.conditionsJson, currentFormValues);
        if (evaluated.requiredFieldIds.has('__opinion__')) {
          requirement = 'required';
        } else if (evaluated.hiddenFieldIds.has('__opinion__')) {
          requirement = 'hidden';
        } else if (evaluated.optionalFieldIds.has('__opinion__')) {
          requirement = 'optional';
        }
      }
    }

    return requirement;
  }, [currentNodeConfig, processType, instance, currentNodeFields, stageFieldValues, activeActionModal, isTargetNodeRejected]);

  // Abertura do modal de ação
  const handleOpenActionModal = (action: 'advance' | 'return' | 'restart') => {
    setActiveActionModal(action);
    setOpinionText('');
    setOpinionError(null);

    // Inicializar valores dos campos da etapa atual com os valores já existentes no processo
    if (instance) {
      const initialStageValues: Record<string, string> = {};
      currentNodeFields.forEach((f) => {
        const existing = instance.fieldValues.find(
          (fv) => fv.fieldDefinitionId === f.fieldDefinitionId
        );
        initialStageValues[f.fieldDefinitionId] = existing?.value || '';
      });
      setStageFieldValues(initialStageValues);
    }

    if (action === 'advance') {
      if (availableAdvanceTransitions.length > 0) {
        setTargetNodeId(availableAdvanceTransitions[0].toNodeId);
      }
    } else if (action === 'return') {
      if (availableReturnTransitions.length > 0) {
        setTargetNodeId(availableReturnTransitions[0].fromNodeId);
      } else if (processType?.startNodeId) {
        setTargetNodeId(processType.startNodeId);
      }
    }
  };

  // Submissão da ação de tramitação
  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instance || !activeActionModal) return;

    // Se for avanço para próxima etapa normal (não rejeição), validar campos obrigatórios da etapa atual
    if (activeActionModal === 'advance' && !isTargetNodeRejected && currentNodeFields.length > 0) {
      const missingFields = currentNodeFields
        .filter((f) => f.isRequired && !(stageFieldValues[f.fieldDefinitionId] || '').trim())
        .map((f) => f.customLabel || f.name);

      if (missingFields.length > 0) {
        setOpinionError(
          `Preencha os campos obrigatórios desta etapa antes de avançar: ${missingFields.join(', ')}.`
        );
        return;
      }
    }

    // Validação de Parecer Obrigatório
    if (opinionRequirementEvaluated === 'required' && !opinionText.trim()) {
      setOpinionError(
        isTargetNodeRejected
          ? 'A justificativa / motivo da reprovação é obrigatória para indeferir o processo.'
          : 'O preenchimento do parecer / justificativa é obrigatório nesta etapa.'
      );
      return;
    }

    setActionLoading(true);
    setOpinionError(null);
    setError(null);

    try {
      if (activeActionModal === 'advance') {
        await workflowsApi.advanceProcess(instance.id, {
          targetNodeId: targetNodeId || undefined,
          observations: opinionText.trim() || undefined,
          fieldValues: Object.keys(stageFieldValues).length > 0 ? stageFieldValues : undefined,
        });
      } else if (activeActionModal === 'return') {
        await workflowsApi.returnProcess(instance.id, {
          targetNodeId: targetNodeId || undefined,
          observations: opinionText.trim() || 'Processo devolvido para adequações.',
        });
      } else if (activeActionModal === 'restart') {
        await workflowsApi.restartProcess(instance.id, {
          observations: opinionText.trim() || 'Processo reiniciado.',
        });
      }

      setActiveActionModal(null);
      await loadProcessData();
    } catch (err: any) {
      setOpinionError(err?.message || 'Erro ao tramitar o processo.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStageFieldInput = (field: ProcessTypeField) => {
    const val = stageFieldValues[field.fieldDefinitionId] || '';
    const setVal = (newValue: string) => {
      setStageFieldValues((prev) => ({
        ...prev,
        [field.fieldDefinitionId]: newValue,
      }));
    };

    const fType = field.type as unknown;
    const isSelect = fType === FieldType.Select || fType === 'Select' || fType === 8;
    const isTextArea = fType === FieldType.TextArea || fType === 'TextArea' || fType === 2;
    const isDate = fType === FieldType.Date || fType === 'Date' || fType === 7;
    const isCurrency = fType === FieldType.Currency || fType === 'Currency' || fType === 4;
    const isNumber = fType === FieldType.Number || fType === 'Number' || fType === 3;

    if (isSelect) {
      let options: string[] = [];
      if (field.globalOptionsJson) {
        try {
          const parsed = JSON.parse(field.globalOptionsJson);
          if (Array.isArray(parsed)) options = parsed.map(String);
        } catch {
          options = field.globalOptionsJson.split(',').map((s) => s.trim());
        }
      }
      return (
        <SelectDropdown
          value={val}
          onChange={setVal}
          options={options.map((opt) => ({ value: opt, label: opt }))}
          placeholder={field.placeholder || 'Selecione uma opção...'}
        />
      );
    }

    if (isTextArea) {
      return (
        <textarea
          rows={3}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={field.placeholder || 'Digite aqui...'}
          className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
        />
      );
    }

    return (
      <input
        type={isDate ? 'date' : isCurrency || isNumber ? 'number' : 'text'}
        step={isCurrency ? '0.01' : undefined}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={field.placeholder || 'Informe o valor...'}
        className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Carregando processo...</p>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Processo não encontrado</h2>
        <p className="text-xs text-slate-500">
          Não foi possível localizar os registros deste processo.
        </p>
        <button
          onClick={() => navigate('/app/workflows')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Central de Processos
        </button>
      </div>
    );
  }

  const st = instance.status as unknown;
  const isApproved = st === ProcessStatus.Approved || st === 'Approved' || st === 4;
  const isRejected = st === ProcessStatus.Rejected || st === 'Rejected' || st === 5;
  const isFinished = st === ProcessStatus.Finished || st === 'Finished' || st === 6;
  const isCancelled = st === ProcessStatus.AdministrativeCancellation || st === 'AdministrativeCancellation' || st === 7;
  const isTerminal = isTerminalProcessStatus(instance.status);
  const isReturned = st === ProcessStatus.Returned || st === 'Returned' || st === 3;
  const isDraft = st === ProcessStatus.Draft || st === 'Draft' || st === 1;
  const canManipulate = !isTerminal && (instance.canManipulate ?? false);

  // Filtragem dos campos no modal "Dados do Processo"
  const filteredFieldValues = instance.fieldValues.filter(
    (fv) =>
      fv.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()) ||
      (fv.value && fv.value.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* Barra de Navegação e Header Delicado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/app/workflows')}
            className="p-2.5 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80 rounded-2xl transition-all shadow-2xs hover:shadow-xs group"
            title="Voltar para a central de processos"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50/80 px-2.5 py-0.5 rounded-lg border border-indigo-200/70 shadow-2xs">
                Processo #{instance.processNumber}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5 shadow-2xs ${
                  isDraft
                    ? 'text-amber-800 bg-amber-50/80 border-amber-200/80'
                    : isApproved
                    ? 'text-emerald-900 bg-emerald-50 border-emerald-300'
                    : isRejected
                    ? 'text-rose-900 bg-rose-50 border-rose-300'
                    : isCancelled
                    ? 'text-rose-950 bg-rose-100 border-rose-300'
                    : isFinished
                    ? 'text-slate-800 bg-slate-100 border-slate-300'
                    : isReturned
                    ? 'text-amber-800 bg-amber-50/80 border-amber-200/80'
                    : 'text-indigo-800 bg-indigo-50/80 border-indigo-200/80'
                }`}
              >
                {!isDraft && !isTerminal && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {isDraft ? (
                  'Rascunho Inicial'
                ) : isApproved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Finalizado — Deferido
                  </>
                ) : isRejected ? (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    Finalizado — Indeferido
                  </>
                ) : isCancelled ? (
                  <>
                    <Ban className="w-3.5 h-3.5 text-rose-700" />
                    Cancelamento Administrativo
                  </>
                ) : isFinished ? (
                  <>
                    <Archive className="w-3.5 h-3.5 text-slate-600" />
                    Concluído e Arquivado
                  </>
                ) : isReturned ? (
                  'Devolvido com Pendência'
                ) : (
                  'Em Análise e Tramitação'
                )}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5">
              {instance.title || instance.processTypeName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/app/workflows')}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Fechar Visualização
          </button>
        </div>
      </div>

      {/* BANNER DE DESTAQUE: PROCESSO EM ESTADO TERMINAL OU CANCELADO */}
      {isApproved && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-emerald-50/40 to-white border border-emerald-300 text-emerald-950 flex items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-emerald-950">Processo Finalizado com Deferimento</h3>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Este processo concluiu seu fluxo com desfecho <strong>Deferido</strong> na etapa <strong>{instance.currentNodeName}</strong>. As tramitações estão oficialmente encerradas e nenhuma alteração posterior é permitida.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-[11px] rounded-lg border border-emerald-300 shadow-2xs">
            Encerrado
          </span>
        </div>
      )}

      {isRejected && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-50 via-rose-50/40 to-white border border-rose-300 text-rose-950 flex items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-rose-950">Processo Finalizado com Indeferimento</h3>
              <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                Este processo concluiu seu fluxo com desfecho <strong>Indeferido</strong> na etapa <strong>{instance.currentNodeName}</strong>. O pedido não foi acolhido e novas transições foram bloqueadas pelo sistema.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 bg-rose-100 text-rose-900 font-extrabold text-[11px] rounded-lg border border-rose-300 shadow-2xs">
            Encerrado
          </span>
        </div>
      )}

      {isFinished && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-100/90 via-slate-50 to-white border border-slate-300 text-slate-900 flex items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-slate-700 text-white rounded-xl shadow-xs shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-950">Processo Concluído e Arquivado</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Este processo completou o ciclo de atendimento na etapa <strong>{instance.currentNodeName}</strong> e foi arquivado no sistema. Novas tramitações foram desabilitadas.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 bg-slate-200 text-slate-800 font-extrabold text-[11px] rounded-lg border border-slate-300 shadow-2xs">
            Arquivado
          </span>
        </div>
      )}

      {isCancelled && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-100/80 via-rose-50/50 to-white border border-rose-300 text-rose-950 flex items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-rose-700 text-white rounded-xl shadow-xs shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-rose-950">Processo com Cancelamento Administrativo</h3>
              <p className="text-xs text-rose-900 mt-0.5 leading-relaxed">
                O fluxo foi paralisado formalmente na etapa <strong>{instance.currentNodeName}</strong> por decisão administrativa. O histórico e o parecer obrigatório de cancelamento estão arquivados e disponíveis na linha de vida abaixo.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 bg-rose-200 text-rose-950 font-extrabold text-[11px] rounded-lg border border-rose-400 shadow-2xs">
            Cancelado
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO SUPERIOR: ESQUERDA (DADOS CHAVE + BOTÃO) | DIREITA (TIMER + AÇÕES)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* PARTE SUPERIOR ESQUERDA (7 COLUNAS): Identificação do Processo */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-indigo-50/80 text-indigo-600 rounded-2xl ring-1 ring-indigo-100/80 shadow-2xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Identificação, Autoria & Unidades (Custódia)
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Rastreabilidade de criador do rascunho, usuário de abertura, unidade de origem e lotação atual.
                </p>
              </div>
            </div>

            {/* Grid 2x2 com Cartões de Rastreabilidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
              {/* 1. Unidade de Origem & Criador do Rascunho */}
              <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100 hover:border-slate-200/80 rounded-2xl p-3.5 transition-all space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Unidade de Origem (Solicitante)
                </span>
                <p className="font-bold text-slate-800 text-sm truncate">
                  {instance.originUnitName || 'Sede da Empresa'}
                </p>
                <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>
                    Criador do rascunho: <strong>{instance.createdByUserName || 'Solicitante'}</strong> ({new Date(instance.createdAt).toLocaleDateString('pt-BR')})
                  </span>
                </p>
              </div>

              {/* 2. Usuário e Unidade de Abertura (Protocolo Formal) */}
              <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100 hover:border-slate-200/80 rounded-2xl p-3.5 transition-all space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                  Abertura / Protocolo Oficial
                </span>
                <p className="font-bold text-indigo-950 text-sm truncate">
                  {instance.openedByUserName || instance.createdByUserName || 'Solicitante'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {instance.openedAt
                    ? `Protocolado em ${new Date(instance.openedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} • ${instance.openedByUnitName || instance.originUnitName || 'Sede'}`
                    : 'Ainda em rascunho (Não protocolado)'}
                </p>
              </div>

              {/* 3. Árvore de Processo */}
              <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100 hover:border-slate-200/80 rounded-2xl p-3.5 transition-all space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                  Árvore de Processo
                </span>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {instance.processTypeName}
                  </p>
                  <span className="font-mono text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                    v{instance.processTypeVersion}
                  </span>
                </div>
              </div>

              {/* 4. Número Sequencial */}
              <div className="bg-slate-50/60 hover:bg-slate-50 border border-slate-100 hover:border-slate-200/80 rounded-2xl p-3.5 transition-all space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Código Único / Protocolo
                </span>
                <p className="font-mono font-black text-indigo-700 text-base tracking-tight">
                  #{instance.processNumber}
                </p>
              </div>

              {/* 5. Unidade Atual / Lotação Destino & Fase Atual */}
              <div className="sm:col-span-2 bg-gradient-to-r from-indigo-50/40 via-slate-50/40 to-white border border-indigo-100/70 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    Unidade Atual / Lotação Destino
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shadow-2xs" />
                    <p className="font-bold text-slate-900 text-xs sm:text-sm">
                      {instance.currentUnitName || instance.destinationUnitName || `Sede - ${instance.areaName}`}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Etapa / Nó Atual</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-white border border-slate-200/80 text-xs font-extrabold text-slate-800 shadow-2xs">
                    {instance.currentNodeName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTÕES "DADOS DO PROCESSO" E "TRANSFERIR UNIDADE" NA PARTE INFERIOR ESQUERDA */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDataModalOpen(true)}
              className="inline-flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white text-xs font-bold rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-700/60 active:scale-[0.99] group"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-300 group-hover:scale-110 transition-transform" />
                <span>Dados do Processo</span>
              </div>
              <span className="bg-white/15 text-indigo-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
                {instance.fieldValues.length} {instance.fieldValues.length === 1 ? 'campo' : 'campos'}
              </span>
            </button>

            {!isTerminal && !isDraft && (canManipulate || canCancel) && (
              <button
                type="button"
                onClick={handleOpenTransferModal}
                className="inline-flex items-center gap-2 px-4 py-3 bg-white hover:bg-indigo-50/70 text-indigo-700 border border-indigo-200/90 text-xs font-bold rounded-2xl shadow-2xs hover:shadow-xs transition-all active:scale-[0.99]"
              >
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <span>Transferir Unidade / Lotação</span>
              </button>
            )}
          </div>
        </div>

        {/* PARTE SUPERIOR DIREITA (5 COLUNAS): Temporizador & Ações de Tramitação */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
          {/* Temporizador do Tempo na Instância */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50/60 to-white rounded-2xl p-4 sm:p-5 border border-indigo-100/80 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Tempo na Instância Atual
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Etapa Ativa
              </span>
            </div>

            {/* Blocos Digitais Delicados */}
            <div className="flex items-center gap-2 pt-1">
              {timeUnits.days > 0 && (
                <div className="flex items-baseline gap-0.5 bg-white/95 border border-indigo-100/90 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="font-mono text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                    {timeUnits.days}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase">d</span>
                </div>
              )}
              <div className="flex items-baseline gap-0.5 bg-white/95 border border-indigo-100/90 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <span className="font-mono text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  {String(timeUnits.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-indigo-500 uppercase">h</span>
              </div>
              <span className="text-slate-300 font-black text-sm">:</span>
              <div className="flex items-baseline gap-0.5 bg-white/95 border border-indigo-100/90 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <span className="font-mono text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  {String(timeUnits.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-indigo-500 uppercase">m</span>
              </div>
              <span className="text-slate-300 font-black text-sm">:</span>
              <div className="flex items-baseline gap-0.5 bg-white/95 border border-indigo-100/90 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <span className="font-mono text-xl sm:text-2xl font-black text-indigo-700 tracking-tight">
                  {String(timeUnits.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold text-indigo-500 uppercase">s</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-indigo-100/50">
              <span>Localização:</span>
              <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 text-[11px]">
                {instance.currentNodeName}
              </span>
            </div>
          </div>

          {/* Bloco de Ações de Tramitação com Bloqueio de Perfil */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Ações de Tramitação
              </span>
              {canManipulate && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  <Check className="w-3 h-3" /> Perfil Autorizado
                </span>
              )}
            </div>

            {isTerminal ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-700 space-y-2 text-center shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-slate-800">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>
                    {isApproved
                      ? 'Processo Deferido (Encerrado)'
                      : isRejected
                      ? 'Processo Indeferido (Encerrado)'
                      : isCancelled
                      ? 'Cancelamento Administrativo'
                      : 'Processo Concluído e Arquivado'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isCancelled
                    ? 'O fluxo foi interrompido administrativamente. Nenhuma nova movimentação pode ser executada.'
                    : 'Este processo atingiu um estado terminal de workflow. Novas transições e alterações estão permanentemente bloqueadas.'}
                </p>
              </div>
            ) : isDraft ? (
              <div className="p-4 bg-amber-50/80 border border-amber-200/80 text-amber-900 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="leading-relaxed">Processo em rascunho de confecção.</span>
                <button
                  onClick={() => navigate(`/app/workflows/processes/${instance.id}/confection`)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all shrink-0"
                >
                  Concluir e Protocolar
                </button>
              </div>
            ) : !canManipulate ? (
              /* AVISO DELICADO DE BLOQUEIO POR FALTA DE ATRIBUIÇÃO NO PERFIL */
              <div className="space-y-3">
                <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-slate-50 p-4 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Modo de Consulta (Somente Leitura)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Seu perfil não possui o local de processo <strong>{instance.currentNodeName}</strong> atribuído para tramitar ou alterar esta etapa. Você pode consultar os dados e pareceres normalmente.
                  </p>
                </div>

                {/* Botões Desabilitados Elegantes */}
                <div className="grid grid-cols-3 gap-2 opacity-50">
                  <button
                    disabled
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs border border-slate-200 cursor-not-allowed"
                    title="Ação bloqueada: atribuição necessária no perfil"
                  >
                    <Lock className="w-4 h-4 mb-1" />
                    <span>Avançar</span>
                  </button>
                  <button
                    disabled
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs border border-slate-200 cursor-not-allowed"
                    title="Ação bloqueada: atribuição necessária no perfil"
                  >
                    <Lock className="w-4 h-4 mb-1" />
                    <span>Devolver</span>
                  </button>
                  <button
                    disabled
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs border border-slate-200 cursor-not-allowed"
                    title="Ação bloqueada: atribuição necessária no perfil"
                  >
                    <Lock className="w-4 h-4 mb-1" />
                    <span>Reiniciar</span>
                  </button>
                </div>
              </div>
            ) : (
              /* BOTÕES ATIVOS PARA USUÁRIO COM LOCAL ATRIBUÍDO NO PERFIL */
              <div className="grid grid-cols-3 gap-2.5">
                {/* Botão Avançar */}
                <button
                  type="button"
                  onClick={() => handleOpenActionModal('advance')}
                  disabled={availableAdvanceTransitions.length === 0}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs transition-all shadow-sm hover:shadow hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed border border-indigo-500/30 group active:scale-[0.98]"
                >
                  <ArrowRight className="w-4 h-4 mb-1.5 group-hover:translate-x-0.5 transition-transform" />
                  <span>Avançar</span>
                </button>

                {/* Botão Devolver */}
                <button
                  type="button"
                  onClick={() => handleOpenActionModal('return')}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white hover:bg-amber-50/80 text-amber-800 font-bold text-xs transition-all border border-amber-200/80 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <CornerUpLeft className="w-4 h-4 mb-1.5 text-amber-600" />
                  <span>Devolver</span>
                </button>

                {/* Botão Reiniciar */}
                <button
                  type="button"
                  onClick={() => handleOpenActionModal('restart')}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white hover:bg-rose-50/80 text-rose-800 font-bold text-xs transition-all border border-rose-200/80 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <RotateCcw className="w-4 h-4 mb-1.5 text-rose-600" />
                  <span>Reiniciar</span>
                </button>
              </div>
            )}

            {/* Botão de Cancelamento Administrativo: Disponível se não estiver encerrado e usuário for autor ou admin */}
            {!isTerminal && !isDraft && canCancel && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleOpenCancelModal}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 rounded-xl transition-all shadow-2xs active:scale-[0.99] group"
                >
                  <Ban className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
                  <span>Cancelar Processo (Administrativo)</span>
                </button>
              </div>
            )}

            {/* Aviso sobre Parecer e Campos Configurados no Nó */}
            {!isTerminal && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                {currentNodeConfig?.opinionConfig && (
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    Parecer nesta etapa:{' '}
                    <strong className="text-slate-700">
                      {currentNodeConfig.opinionConfig.requirement === 'required'
                        ? 'Obrigatório'
                        : currentNodeConfig.opinionConfig.requirement === 'hidden'
                        ? 'Oculto'
                        : 'Opcional'}
                    </strong>
                  </span>
                )}
                {currentNodeFields.length > 0 && (
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {currentNodeFields.length} {currentNodeFields.length === 1 ? 'campo nesta etapa' : 'campos nesta etapa'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO INFERIOR: DO MEIO PRA BAIXO - LINHA DE VIDA DE CADA INSTÂNCIA       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50/80 text-indigo-600 rounded-2xl ring-1 ring-indigo-100/80 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Linha de Vida do Processo (Histórico de Instâncias e Transferências)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Rastreabilidade de todas as etapas, movimentações entre unidades e pareceres emitidos.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-extrabold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/70 shadow-2xs">
            {instance.history.length} {instance.history.length === 1 ? 'evento' : 'eventos'}
          </span>
        </div>

        {/* Timeline Visual Contínua Refinada */}
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-slate-200 before:to-slate-100">
          {instance.history.map((hist, index) => {
            const isLatest = index === 0;

            const isAdvance = isAdvanceAction(hist.action);
            const isReturn = isReturnAction(hist.action);
            const isRestart = isRestartAction(hist.action);
            const isCancel = isCancelAction(hist.action);
            const isTransfer = isTransferAction(hist.action);

            const badgeBg = isCancel
              ? 'bg-rose-700 text-white shadow-rose-200'
              : isTransfer
              ? 'bg-violet-600 text-white shadow-violet-200'
              : isAdvance
              ? 'bg-indigo-600 text-white shadow-indigo-100'
              : isReturn
              ? 'bg-amber-500 text-white shadow-amber-100'
              : isRestart
              ? 'bg-rose-600 text-white shadow-rose-100'
              : 'bg-slate-700 text-white shadow-slate-100';

            return (
              <div key={hist.id} className="relative group">
                {/* Marcador na Linha com Efeito Suave */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-110 ${badgeBg}`}
                >
                  {isCancel ? (
                    <Ban className="w-3.5 h-3.5" />
                  ) : isTransfer ? (
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  ) : isAdvance ? (
                    <ArrowRight className="w-3.5 h-3.5" />
                  ) : isReturn ? (
                    <CornerUpLeft className="w-3.5 h-3.5" />
                  ) : isRestart ? (
                    <RotateCcw className="w-3.5 h-3.5" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Card de Evento da Instância */}
                <div
                  className={`bg-white rounded-2xl border p-5 space-y-3 transition-all ${
                    isCancel
                      ? 'border-rose-300 shadow-sm ring-1 ring-rose-500/10'
                      : isTransfer
                      ? 'border-violet-200 shadow-sm ring-1 ring-violet-500/10'
                      : isLatest
                      ? 'border-indigo-200 shadow-sm ring-1 ring-indigo-500/10'
                      : 'border-slate-200/70 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Cabeçalho do Evento */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isTransfer ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-800 bg-violet-50 px-2.5 py-0.5 rounded-md border border-violet-200">
                            <ArrowRightLeft className="w-3 h-3 text-violet-600" />
                            Transferência de Unidade
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-slate-700">
                            {hist.fromUnitName || 'Unidade Anterior'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                          <span className="font-bold text-xs sm:text-sm text-violet-950 bg-violet-50 px-2.5 py-0.5 rounded-lg border border-violet-200">
                            {hist.toUnitName || 'Nova Unidade'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            (Etapa mantida: <strong>{hist.toNodeName || instance.currentNodeName}</strong>)
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-xs sm:text-sm text-slate-800">
                            {hist.fromNodeName || 'Origem Inicial'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-xs sm:text-sm text-indigo-900 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                            {hist.toNodeName || 'Destino'}
                          </span>
                        </>
                      )}

                      {isCancel ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <Ban className="w-3 h-3 text-rose-600" />
                          Cancelamento Administrativo
                        </span>
                      ) : hist.observations && hist.observations.trim() ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-200/60">
                          <MessageSquare className="w-3 h-3 text-indigo-500" />
                          Parecer Registrado
                        </span>
                      ) : null}
                      {isLatest && !isTerminal && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                          Evento Recente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(hist.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Informações do Ator / Movimentador */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-700">
                      {(hist.userFullName || 'U').charAt(0)}
                    </div>
                    <span>
                      {isTransfer ? 'Transferido por:' : 'Movimentado por:'}{' '}
                      <strong className="text-slate-800">{hist.userFullName || 'Usuário do Sistema'}</strong>
                    </span>
                  </div>

                  {/* DESTAQUE VISUAL REFINADO DO PARECER / DESPACHO */}
                  {hist.observations && hist.observations.trim() && (
                    <div className="mt-2 rounded-r-2xl border-l-4 border-indigo-600 border-y border-r border-indigo-100/70 bg-gradient-to-r from-indigo-50/40 via-indigo-50/15 to-white p-4 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                          {isTransfer ? 'Motivo / Despacho da Transferência' : 'Parecer / Despacho Registrado'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-wrap pl-0.5">
                        {hist.observations}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL REFINADO: "DADOS DO FORMULÁRIO DO PROCESSO"                         */}
      {/* ========================================================================= */}
      {isDataModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] border border-slate-200/80 overflow-hidden">
            {/* Header Delicado */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50/80 text-indigo-600 rounded-2xl ring-1 ring-indigo-100/80">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Dados do Formulário do Processo
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Processo #{instance.processNumber} • {instance.processTypeName} v{instance.processTypeVersion}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDataModalOpen(false);
                  setFieldSearchTerm('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Busca Rápida de Campos */}
            {instance.fieldValues.length > 4 && (
              <div className="px-6 py-3 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fieldSearchTerm}
                    onChange={(e) => setFieldSearchTerm(e.target.value)}
                    placeholder="Filtrar campos ou valores..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 font-medium text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Conteúdo com Grade Delicada de Campos */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {instance.fieldValues.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  Nenhum campo foi preenchido neste processo.
                </div>
              ) : filteredFieldValues.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum campo corresponde à busca realizada.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredFieldValues.map((fv) => (
                    <div
                      key={fv.fieldDefinitionId}
                      className="bg-slate-50/70 hover:bg-indigo-50/20 border border-slate-200/70 hover:border-indigo-200/80 rounded-2xl p-4 transition-all space-y-1.5 shadow-2xs"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        {fv.name}
                      </span>
                      <p className="text-sm font-semibold text-slate-900 break-words leading-relaxed">
                        {fv.value ? (
                          fv.type === FieldType.Currency ? `R$ ${fv.value}` : fv.value
                        ) : (
                          <span className="text-slate-400 font-normal italic text-xs">Não informado</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé Delicado */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                {instance.fieldValues.length} {instance.fieldValues.length === 1 ? 'campo registrado' : 'campos registrados'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsDataModalOpen(false);
                  setFieldSearchTerm('');
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAÇÃO DE AÇÃO DE TRAMITAÇÃO COM CAMPOS DA ETAPA E PARECER    */}
      {/* ========================================================================= */}
      {activeActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200/80">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl text-white shadow-2xs ${
                  activeActionModal === 'advance'
                    ? 'bg-indigo-600'
                    : activeActionModal === 'return'
                    ? 'bg-amber-500'
                    : 'bg-rose-600'
                }`}>
                  {activeActionModal === 'advance' ? (
                    <ArrowRight className="w-4 h-4" />
                  ) : activeActionModal === 'return' ? (
                    <CornerUpLeft className="w-4 h-4" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {activeActionModal === 'advance'
                      ? 'Avançar Processo'
                      : activeActionModal === 'return'
                      ? 'Devolver Processo'
                      : 'Reiniciar Processo'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Processo #{instance.processNumber} • Etapa atual: {instance.currentNodeName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveActionModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAction} className="p-6 space-y-4 overflow-y-auto">
              {opinionError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200/80 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{opinionError}</span>
                </div>
              )}

              {/* Seleção do Nó de Destino */}
              {activeActionModal === 'advance' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Decisão / Próxima Etapa de Destino <span className="text-rose-500">*</span>
                  </label>
                  {availableAdvanceTransitions.length === 1 ? (
                    <div className="p-3 bg-indigo-50/80 border border-indigo-200/70 text-indigo-900 text-xs font-bold rounded-xl flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{availableAdvanceTransitions[0].toNodeName}</span>
                    </div>
                  ) : (
                    <SelectDropdown
                      value={targetNodeId}
                      onChange={(val) => setTargetNodeId(val)}
                      options={availableAdvanceTransitions.map((t) => ({
                        value: t.toNodeId,
                        label: t.toNodeName,
                      }))}
                      placeholder="Selecione o destino de avanço"
                    />
                  )}
                </div>
              )}

              {activeActionModal === 'return' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Etapa de Devolução <span className="text-rose-500">*</span>
                  </label>
                  {availableReturnTransitions.length === 1 ? (
                    <div className="p-3 bg-amber-50/80 border border-amber-200/70 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-2">
                      <CornerUpLeft className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{availableReturnTransitions[0].fromNodeName}</span>
                    </div>
                  ) : (
                    <SelectDropdown
                      value={targetNodeId}
                      onChange={(val) => setTargetNodeId(val)}
                      options={availableReturnTransitions.map((t) => ({
                        value: t.fromNodeId,
                        label: t.fromNodeName,
                      }))}
                      placeholder="Selecione a etapa de retorno"
                    />
                  )}
                </div>
              )}

              {/* CAMPOS VINCULADOS À ETAPA ATUAL (Preenchimento Obrigatório/Opcional antes de Avançar) */}
              {activeActionModal === 'advance' && !isTargetNodeRejected && currentNodeFields.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900">
                      Dados e Campos Exigidos nesta Etapa ({instance.currentNodeName})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {currentNodeFields.map((field) => (
                      <div key={field.id} className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">
                          {field.customLabel || field.name}
                          {field.isRequired && <span className="text-rose-500 ml-1">*</span>}
                        </label>
                        {renderStageFieldInput(field)}
                        {field.helpText && (
                          <p className="text-[10px] text-slate-400">{field.helpText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campo de Parecer / Despacho (Regra de Parecer aplicada) */}
              {opinionRequirementEvaluated !== 'hidden' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      {isTargetNodeRejected
                        ? 'Justificativa / Motivo da Reprovação (Indeferimento)'
                        : 'Parecer / Despacho Técnico'}
                      {opinionRequirementEvaluated === 'required' ? (
                        <span className="text-rose-500 ml-1 font-bold">* (Obrigatório)</span>
                      ) : (
                        <span className="text-slate-400 font-normal ml-1">(Opcional)</span>
                      )}
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    required={opinionRequirementEvaluated === 'required'}
                    value={opinionText}
                    onChange={(e) => setOpinionText(e.target.value)}
                    placeholder={
                      isTargetNodeRejected
                        ? 'Descreva obrigatoriamente o motivo formal da reprovação desta solicitação...'
                        : 'Digite seu parecer, considerações ou justificativa que ficará visível na linha de vida do processo...'
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">
                    Este parecer será registrado publicamente na Linha de Vida do Processo com seu nome e carimbo de data/hora.
                  </p>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveActionModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 ${
                    activeActionModal === 'advance'
                      ? isTargetNodeRejected
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                      : activeActionModal === 'return'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionLoading ? 'Processando...' : 'Confirmar Tramitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FLUTUANTE CENTRALIZADO: TRANSFERÊNCIA DE PROCESSO ENTRE UNIDADES     */}
      {/* ========================================================================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden border border-slate-200/80">
            <div className="px-6 py-4 border-b border-violet-100 flex items-center justify-between bg-violet-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-600 text-white shadow-2xs">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Transferir Processo de Unidade / Lotação
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Processo #{instance.processNumber} • Mantém o estado e etapa atual intactos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Unidade / Lotação Atual (Origem da Transferência)
                </span>
                <p className="font-bold text-slate-800">
                  {instance.currentUnitName || instance.originUnitName || 'Sede da Empresa'}
                </p>
              </div>

              {transferError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{transferError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Unidade / Departamento de Destino <span className="text-rose-500">*</span>
                </label>
                <SelectDropdown
                  value={selectedTransferUnitId}
                  onChange={(val) => setSelectedTransferUnitId(val)}
                  options={companyUnits.map((u) => ({
                    value: u.id,
                    label: u.code ? `${u.name} (${u.code})` : u.name,
                  }))}
                  placeholder="Selecione a nova unidade responsável..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Justificativa / Despacho da Transferência <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={transferObservations}
                  onChange={(e) => setTransferObservations(e.target.value)}
                  placeholder="Informe o motivo da movimentação de custódia entre unidades..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 outline-none font-medium text-slate-800"
                />
                <p className="text-[11px] text-slate-400">
                  A transferência registrará na auditoria a data/hora, seu usuário, a unidade anterior e a unidade de destino.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
                >
                  {transferLoading ? 'Transferindo...' : 'Confirmar Transferência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FLUTUANTE CENTRALIZADO: CANCELAMENTO ADMINISTRATIVO COM JUSTIFICATIVA*/}
      {/* ========================================================================= */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 transform transition-all duration-200 ease-out scale-100">
            <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-600 text-white shadow-2xs">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Cancelamento Administrativo
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Processo #{instance.processNumber} • Interrupção formal do fluxo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteCancel} className="p-6 space-y-4">
              <div className="p-3.5 bg-rose-50/70 border border-rose-200/70 rounded-2xl text-xs text-rose-900 space-y-1">
                <p className="font-bold">Atenção: O processo não será excluído.</p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  O fluxo é interrompido permanentemente no local atual (<strong>{instance.currentNodeName}</strong>).
                  A justificativa e o autor do cancelamento serão registrados para fins de auditoria e constarão na linha de vida.
                </p>
              </div>

              {cancelError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Justificativa / Parecer do Cancelamento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Informe detalhadamente o motivo do cancelamento administrativo (mínimo 5 caracteres)..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none font-medium text-slate-800"
                />
                <p className="text-[11px] text-slate-400">
                  Esta ação é restrita ao autor do processo ou administradores da respectiva área.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Voltar / Não Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
                >
                  {cancelLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
