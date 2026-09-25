import React, { useState, useEffect, useCallback } from 'react';
import {
  Workflow,
  Inbox,
  UserCheck,
  GitBranch,
  GitCommit,
  Tag,
  Plus,
  RefreshCw,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import * as workflowsApi from '../api';
import type {
  FieldDefinition,
  ProcessNode,
  ProcessTypeSummary,
  ProcessInstanceSummary,
} from '../types';
import {
  ProcessInboxTab,
  ProcessTypesTab,
  ProcessNodesCatalogTab,
  FieldsCatalogTab,
  OpenProcessModal,
} from '../components';

export const WorkflowsPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;
  const isCompanyAdmin = user?.roles.includes(SystemRoles.CompanyAdmin) ?? false;

  const [activeTab, setActiveTab] = useState<'inbox' | 'my' | 'trees' | 'nodes' | 'fields'>('inbox');
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dados da Área selecionada
  const [areaProcesses, setAreaProcesses] = useState<ProcessInstanceSummary[]>([]);
  const [myProcesses, setMyProcesses] = useState<ProcessInstanceSummary[]>([]);
  const [processTypes, setProcessTypes] = useState<ProcessTypeSummary[]>([]);
  const [nodes, setNodes] = useState<ProcessNode[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);

  // Modal de Abertura
  const [isOpenProcessModalOpen, setIsOpenProcessModalOpen] = useState(false);

  // Permissões
  const canManage = isSuperAdmin || isCompanyAdmin; // gestores
  const canHandle = isSuperAdmin || isCompanyAdmin || !user?.unitId; // quem pode tramitar (sede/admin)

  // 1. Carrega áreas da empresa do usuário
  useEffect(() => {
    async function loadAreas() {
      if (!user?.companyId) return;
      try {
        const areaList = await getAreasByCompanyId(user.companyId);
        setAreas(areaList);
        if (areaList.length > 0) {
          setSelectedAreaId(areaList[0].id);
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar áreas da empresa.');
      }
    }
    loadAreas();
  }, [user?.companyId]);

  // 2. Carrega dados vinculados à área selecionada
  const loadAreaData = useCallback(async () => {
    if (!selectedAreaId) return;
    setLoading(true);
    setError(null);

    try {
      const [procsData, myProcsData, typesData, nodesData, fieldsData] = await Promise.all([
        workflowsApi.getAreaProcesses(selectedAreaId).catch(() => []),
        workflowsApi.getMyProcesses().catch(() => []),
        workflowsApi.getProcessTypesByAreaId(selectedAreaId).catch(() => []),
        workflowsApi.getNodesByAreaId(selectedAreaId).catch(() => []),
        workflowsApi.getFieldsByAreaId(selectedAreaId).catch(() => []),
      ]);

      setAreaProcesses(procsData);
      setMyProcesses(myProcsData);
      setProcessTypes(typesData);
      setNodes(nodesData);
      setFields(fieldsData);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados do módulo de fluxos.');
    } finally {
      setLoading(false);
    }
  }, [selectedAreaId]);

  useEffect(() => {
    loadAreaData();
  }, [loadAreaData]);

  return (
    <div className="space-y-6">
      {/* Header com Seletor de Área */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Módulo de Workflows & Processos
            </h1>
            <p className="text-sm text-slate-500">
              Gestão de fluxos por área da sede, catálogos reutilizáveis e atendimento operacional de chamados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {areas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Área:
              </span>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadAreaData}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Atualizar Dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsOpenProcessModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            + Abrir Processo
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navegação de Abas do Módulo */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 flex overflow-x-auto shadow-sm">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            activeTab === 'inbox'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Processos da Área
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'inbox' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {areaProcesses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('my')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            activeTab === 'my'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Minhas Solicitações
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'my' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {myProcesses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trees')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            activeTab === 'trees'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          Árvores de Processos
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'trees' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {processTypes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            activeTab === 'nodes'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <GitCommit className="w-4 h-4" />
          Catálogo de Locais
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'nodes' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {nodes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            activeTab === 'fields'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          Catálogo de Campos
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'fields' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {fields.length}
          </span>
        </button>
      </div>

      {/* Conteúdo da Aba */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
          Carregando informações da área...
        </div>
      ) : (
        <>
          {activeTab === 'inbox' && (
            <ProcessInboxTab
              areaId={selectedAreaId}
              processes={areaProcesses}
              onRefresh={loadAreaData}
              onOpenNewProcess={() => setIsOpenProcessModalOpen(true)}
              canHandle={canHandle}
            />
          )}

          {activeTab === 'my' && (
            <ProcessInboxTab
              areaId={selectedAreaId}
              processes={myProcesses}
              onRefresh={loadAreaData}
              onOpenNewProcess={() => setIsOpenProcessModalOpen(true)}
              canHandle={canHandle}
            />
          )}

          {activeTab === 'trees' && (
            <ProcessTypesTab
              areaId={selectedAreaId}
              processTypes={processTypes}
              availableNodes={nodes}
              availableFields={fields}
              onRefresh={loadAreaData}
              canManage={canManage}
            />
          )}

          {activeTab === 'nodes' && (
            <ProcessNodesCatalogTab
              areaId={selectedAreaId}
              nodes={nodes}
              onRefresh={loadAreaData}
              canManage={canManage}
            />
          )}

          {activeTab === 'fields' && (
            <FieldsCatalogTab
              areaId={selectedAreaId}
              fields={fields}
              onRefresh={loadAreaData}
              canManage={canManage}
            />
          )}
        </>
      )}

      {/* Modal de Abertura de Novo Processo */}
      {isOpenProcessModalOpen && (
        <OpenProcessModal
          onClose={() => setIsOpenProcessModalOpen(false)}
          onCreated={() => {
            setIsOpenProcessModalOpen(false);
            loadAreaData();
            setActiveTab('my');
          }}
        />
      )}
    </div>
  );
};
