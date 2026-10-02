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
  Building,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { getCompanies } from '../../companies/api';
import type { Company } from '../../companies/types';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import { getAccessesByUser } from '../../access-control/api';
import type { UserAreaAccess } from '../../access-control/types';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAreaParam = searchParams.get('areaId') || '';

  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;
  const isCompanyAdmin = user?.roles.includes(SystemRoles.CompanyAdmin) ?? false;

  const [activeTab, setActiveTab] = useState<'inbox' | 'my' | 'trees' | 'nodes' | 'fields'>('inbox');

  // Gestão de Empresas e Áreas Selecionadas
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(user?.companyId || '');

  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(initialAreaParam);

  const [userAccesses, setUserAccesses] = useState<UserAreaAccess[]>([]);

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

  // 1. Carrega Empresas se for Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      getCompanies()
        .then((data) => {
          const activeCompanies = data.filter((c) => c.isActive);
          setCompanies(activeCompanies);
          if (activeCompanies.length > 0) {
            setSelectedCompanyId((prev) => prev || activeCompanies[0].id);
          }
        })
        .catch((err: any) => {
          setError(err?.message || 'Erro ao carregar empresas.');
        });
    } else if (user?.companyId) {
      setSelectedCompanyId(user.companyId);
    }
  }, [isSuperAdmin, user?.companyId]);

  // 2. Carrega acessos granulares do usuário
  useEffect(() => {
    if (!isSuperAdmin && !isCompanyAdmin && user?.id) {
      getAccessesByUser(user.id)
        .then((data) => setUserAccesses(data.filter((a) => a.isActive)))
        .catch(() => setUserAccesses([]));
    }
  }, [isSuperAdmin, isCompanyAdmin, user?.id]);

  // 3. Carrega Áreas da Empresa selecionada
  useEffect(() => {
    if (!selectedCompanyId) {
      setAreas([]);
      setSelectedAreaId('');
      setLoading(false);
      return;
    }

    let isMounted = true;
    getAreasByCompanyId(selectedCompanyId)
      .then((data) => {
        if (!isMounted) return;
        const activeAreas = data.filter((a) => a.isActive);
        setAreas(activeAreas);
        if (activeAreas.length > 0) {
          setSelectedAreaId((prev) => {
            if (prev && activeAreas.some((a) => a.id === prev)) return prev;
            return activeAreas[0].id;
          });
        } else {
          setSelectedAreaId('');
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setAreas([]);
        setSelectedAreaId('');
        setLoading(false);
        setError(err?.message || 'Erro ao carregar áreas da empresa selecionada.');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCompanyId]);

  // 4. Carrega dados vinculados à área selecionada e solicitações do usuário
  const loadAreaData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const myProcsPromise = workflowsApi.getMyProcesses().catch(() => []);

      if (!selectedAreaId) {
        const myProcs = await myProcsPromise;
        setMyProcesses(myProcs);
        setAreaProcesses([]);
        setProcessTypes([]);
        setNodes([]);
        setFields([]);
        setLoading(false);
        return;
      }

      const [procsData, myProcsData, typesData, nodesData, fieldsData] = await Promise.all([
        workflowsApi.getAreaProcesses(selectedAreaId).catch(() => []),
        myProcsPromise,
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

  // Permissões calculadas por área
  const currentAreaAccess = userAccesses.find((a) => a.areaId === selectedAreaId && a.isActive);
  const canManage =
    isSuperAdmin ||
    isCompanyAdmin ||
    (currentAreaAccess?.canManageWorkflows ?? false) ||
    (currentAreaAccess?.canManage ?? false);

  const canHandle =
    isSuperAdmin ||
    isCompanyAdmin ||
    (currentAreaAccess?.canHandleWorkflowRequests ?? false) ||
    (currentAreaAccess?.canManage ?? false);

  return (
    <div className="space-y-6">
      {/* Header com Seletor de Empresa e Área */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Empresa para SuperAdmin */}
          {isSuperAdmin && companies.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Building className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Empresa:</span>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedAreaId('');
                  setSearchParams({});
                }}
                className="px-2 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seletor de Área da Sede */}
          {areas.length > 0 ? (
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-600">Área:</span>
              <select
                value={selectedAreaId}
                onChange={(e) => {
                  setSelectedAreaId(e.target.value);
                  if (e.target.value) {
                    setSearchParams({ areaId: e.target.value });
                  } else {
                    setSearchParams({});
                  }
                }}
                className="px-2 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
              Nenhuma área cadastrada
            </span>
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
            Abrir Processo
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
      ) : !selectedAreaId && activeTab !== 'my' ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Nenhuma Área da Sede Selecionada</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Para gerenciar árvores, locais e campos reutilizáveis, é necessário que a empresa possua áreas cadastradas na sede. Selecione outra empresa acima ou cadastre áreas no menu de Governança.
          </p>
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
