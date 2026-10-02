import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  ArrowLeft,
  Save,
  Play,
  CheckCircle2,
  Plus,
  AlertCircle,
  GitMerge,
  History,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/providers';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import * as workflowsApi from '../api';
import type {
  ProcessType,
  ProcessNode,
  FieldDefinition,
  CreateProcessTypePayload,
  UpdateProcessTypePayload,
  ProcessNodeTypeValue,
} from '../types';
import {
  ProcessNodeType,
  ProcessAudience,
  ProcessTypeStatus,
  normalizeProcessTypeStatus,
  normalizeProcessAudience,
  isDraftStatus,
  isHomologatedStatus,
  isArchivedStatus,
} from '../types';
import {
  WorkflowCustomNode,
  type WorkflowCustomNodeData,
} from '../components/WorkflowCustomNode';
import {
  NodeConfigMacroModal,
  type NodeFieldItemConfig,
} from '../components/NodeConfigMacroModal';
import { ProcessSimulatorModal } from '../components/ProcessSimulatorModal';

const nodeTypes = {
  workflowNode: WorkflowCustomNode,
};

export const ProcessTreeBuilderPage: React.FC = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEditing = Boolean(treeId && treeId !== 'new');
  const targetAreaId = searchParams.get('areaId') || '';

  // Metadados da Árvore
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState<number>(ProcessAudience.All);
  const [areaId, setAreaId] = useState(targetAreaId);
  const [versionNumber, setVersionNumber] = useState(1);
  const [status, setStatus] = useState<number>(ProcessTypeStatus.Draft);

  // Catálogos Carregados da Área
  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [availableCatalogNodes, setAvailableCatalogNodes] = useState<ProcessNode[]>([]);
  const [availableCatalogFields, setAvailableCatalogFields] = useState<FieldDefinition[]>([]);

  // Estados do React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowCustomNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Mapeamento de Configuração de Campos por Nó (nodeId -> NodeFieldItemConfig[])
  const [nodeFieldsMap, setNodeFieldsMap] = useState<Record<string, NodeFieldItemConfig[]>>({});
  // Mapeamento de Instruções por Nó (nodeId -> string)
  const [nodeInstructionsMap, setNodeInstructionsMap] = useState<Record<string, string>>({});
  // Mapeamento de ProcessNodeId associado por Nó do Canvas (nodeId -> processNodeId)
  const [nodeLocationMap, setNodeLocationMap] = useState<Record<string, string>>({});

  // Modal Macro de Configuração de Nó Selecionado
  const [selectedConfigNodeId, setSelectedConfigNodeId] = useState<string | null>(null);

  // Modal de Simulação (Debug)
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [currentProcessTypeForSimulation, setCurrentProcessTypeForSimulation] = useState<ProcessType | null>(null);

  // Feedback e Loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-gerar código a partir do nome
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing) {
      const generatedCode = 'proc_' + val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setCode(generatedCode);
    }
  };

  // Carregar Áreas da Empresa
  useEffect(() => {
    if (user?.companyId) {
      getAreasByCompanyId(user.companyId)
        .then((data) => {
          const activeAreas = data.filter((a) => a.isActive);
          setAreas(activeAreas);
          if (!areaId && activeAreas.length > 0) {
            setAreaId(activeAreas[0].id);
          }
        })
        .catch(() => {});
    }
  }, [user?.companyId, areaId]);

  // Carregar Catálogo de Locais e Campos da Área selecionada
  const loadCatalogs = useCallback(async (currentAreaId: string) => {
    if (!currentAreaId) return;
    try {
      const [nodesData, fieldsData] = await Promise.all([
        workflowsApi.getNodesByAreaId(currentAreaId).catch(() => []),
        workflowsApi.getFieldsByAreaId(currentAreaId).catch(() => []),
      ]);
      setAvailableCatalogNodes(nodesData.filter((n) => n.isActive));
      setAvailableCatalogFields(fieldsData.filter((f) => f.isActive));
    } catch {
      // Ignora erro silencioso
    }
  }, []);

  useEffect(() => {
    if (areaId) {
      loadCatalogs(areaId);
    }
  }, [areaId, loadCatalogs]);

  // Referência para controlar inicialização única da árvore e evitar resets acidentais
  const isTreeInitializedRef = React.useRef(false);
  const loadedTreeIdRef = React.useRef<string | null>(null);

  // Handler para configurar um nó (abre o modal macro)
  const handleOpenConfigureNode = useCallback((nodeId: string) => {
    setSelectedConfigNodeId(nodeId);
  }, []);

  // Handler para remover nó (sem depender de selectedConfigNodeId para manter referência estável)
  const handleDeleteNode = useCallback(
    (nodeIdToDelete: string) => {
      setNodes((currentNodes) =>
        currentNodes.filter((n) => n.id !== nodeIdToDelete && !n.data.isStart)
      );
      setEdges((currentEdges) =>
        currentEdges.filter(
          (e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete
        )
      );
      setSelectedConfigNodeId((curr) => (curr === nodeIdToDelete ? null : curr));
    },
    [setNodes, setEdges]
  );

  // Handler para adicionar filho conectado a um nó (corrige arestas duplicadas e StrictMode)
  const handleAddChildToNode = useCallback(
    (parentNodeId: string) => {
      const childId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const defaultLabel = 'Nova Etapa de Análise';
      const defaultCode = 'analise_' + Math.floor(Math.random() * 1000);

      setNodes((currentNodes) => {
        const parentNode = currentNodes.find((n) => n.id === parentNodeId);
        const newX = parentNode ? parentNode.position.x + 320 : 400;
        const newY = parentNode ? parentNode.position.y + 50 : 200;

        const newNode: Node<WorkflowCustomNodeData> = {
          id: childId,
          type: 'workflowNode',
          position: { x: newX, y: newY },
          data: {
            id: childId,
            label: defaultLabel,
            code: defaultCode,
            nodeType: ProcessNodeType.StandardStage,
            fieldsCount: 0,
            isStart: false,
            onConfigure: handleOpenConfigureNode,
            onAddChild: handleAddChildToNode,
            onDelete: handleDeleteNode,
          },
        };
        return [...currentNodes, newNode];
      });

      // Adiciona aresta fora do updater de nós, garantindo unicidade do ID
      setEdges((currentEdges) => {
        const edgeId = `e_${parentNodeId}_${childId}`;
        if (currentEdges.some((e) => e.id === edgeId)) return currentEdges;
        return [
          ...currentEdges,
          {
            id: edgeId,
            source: parentNodeId,
            target: childId,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
            style: { stroke: '#4f46e5', strokeWidth: 2 },
          },
        ];
      });
    },
    [handleOpenConfigureNode, handleDeleteNode, setNodes, setEdges]
  );

  // Inicializar Árvore Nova ou Carregar Existente (uma única vez por ID/sessão)
  useEffect(() => {
    if (isEditing && treeId) {
      if (loadedTreeIdRef.current === treeId) return;
      loadedTreeIdRef.current = treeId;
      setLoading(true);

      workflowsApi
        .getProcessTypeById(treeId)
        .then((pt: ProcessType) => {
          setName(pt.name);
          setCode(pt.code);
          setDescription(pt.description || '');
          setTargetAudience(normalizeProcessAudience(pt.targetAudience));
          setAreaId(pt.areaId);
          setVersionNumber(pt.versionNumber);
          setStatus(normalizeProcessTypeStatus(pt.status));

          // Mapear campos por nó
          const fieldsMap: Record<string, NodeFieldItemConfig[]> = {};
          pt.fields.forEach((f) => {
            const nId = f.processNodeId || pt.startNodeId || 'root_confeccao';
            if (!fieldsMap[nId]) fieldsMap[nId] = [];
            fieldsMap[nId].push({
              fieldDefinitionId: f.fieldDefinitionId,
              isRequired: f.isRequired,
              displayOrder: f.displayOrder,
              customLabel: f.customLabel,
              helpText: f.helpText,
              conditionsJson: f.conditionsJson,
            });
          });
          setNodeFieldsMap(fieldsMap);

          // Mapear instruções e locais
          const instructionsMap: Record<string, string> = {};
          const locationsMap: Record<string, string> = {};

          // Construir Nodos do React Flow
          const flowNodes: Node<WorkflowCustomNodeData>[] = pt.nodes.map((node, index) => {
            const isStart =
              node.processNodeId === pt.startNodeId ||
              node.nodeType === ProcessNodeType.StartConfection ||
              index === 0;
            instructionsMap[node.processNodeId] = node.instructions || '';
            locationsMap[node.processNodeId] = node.processNodeId;

            const attachedFieldsCount = (fieldsMap[node.processNodeId] || []).length;
            const posX = 100 + (index % 3) * 320;
            const posY = 120 + Math.floor(index / 3) * 220;

            return {
              id: node.processNodeId,
              type: 'workflowNode',
              position: { x: posX, y: posY },
              data: {
                id: node.processNodeId,
                label: node.name,
                code: node.code,
                nodeType: node.nodeType,
                processNodeId: node.processNodeId,
                instructions: node.instructions,
                fieldsCount: attachedFieldsCount,
                isStart: isStart,
                onConfigure: handleOpenConfigureNode,
                onAddChild: handleAddChildToNode,
                onDelete: handleDeleteNode,
              },
            };
          });

          // Construir Arestas de Transição do React Flow
          const flowEdges: Edge[] = pt.transitions.map((t) => ({
            id: `e_${t.fromNodeId}_${t.toNodeId}`,
            source: t.fromNodeId,
            target: t.toNodeId,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
            style: { stroke: '#4f46e5', strokeWidth: 2 },
          }));

          setNodeInstructionsMap(instructionsMap);
          setNodeLocationMap(locationsMap);
          setNodes(flowNodes);
          setEdges(flowEdges);
        })
        .catch((err) => {
          setFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'Erro ao carregar árvore.',
          });
        })
        .finally(() => setLoading(false));
    } else if (!isEditing) {
      if (isTreeInitializedRef.current) return;
      isTreeInitializedRef.current = true;

      // Criação de Nova Árvore: Inicializa obrigatoriamente com o nó raiz "Confecção" apenas uma vez
      const rootNodeId = 'root_confeccao';
      const rootNode: Node<WorkflowCustomNodeData> = {
        id: rootNodeId,
        type: 'workflowNode',
        position: { x: 120, y: 150 },
        data: {
          id: rootNodeId,
          label: 'Confecção / Abertura Inicial',
          code: 'confeccao',
          nodeType: ProcessNodeType.StartConfection,
          fieldsCount: 0,
          isStart: true,
          onConfigure: handleOpenConfigureNode,
          onAddChild: handleAddChildToNode,
          onDelete: handleDeleteNode,
        },
      };

      setNodes([rootNode]);
      setEdges([]);
      setNodeFieldsMap({});
      setNodeInstructionsMap({});
      setNodeLocationMap({});
      setLoading(false);
    }
  }, [isEditing, treeId, handleOpenConfigureNode, handleAddChildToNode, handleDeleteNode, setNodes, setEdges]);

  // Atualizar contador de campos nos dados dos nós sempre que o nodeFieldsMap mudar
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((n) => {
        const count = (nodeFieldsMap[n.id] || []).length;
        if (n.data.fieldsCount !== count) {
          return {
            ...n,
            data: {
              ...n.data,
              fieldsCount: count,
              instructions: nodeInstructionsMap[n.id] || '',
            },
          };
        }
        return n;
      })
    );
  }, [nodeFieldsMap, nodeInstructionsMap, setNodes]);

  // Conexão manual entre nós arrastando handles
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;
      const edgeId = `e_${params.source}_${params.target}`;
      setEdges((eds) => {
        if (eds.some((e) => (e.source === params.source && e.target === params.target) || e.id === edgeId)) {
          return eds;
        }
        return addEdge(
          {
            ...params,
            id: edgeId,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
            style: { stroke: '#4f46e5', strokeWidth: 2 },
          },
          eds
        );
      });
    },
    [setEdges]
  );

  // Adicionar Nó Avulso a partir da Toolbar
  const handleAddStandaloneNode = (presetType?: ProcessNodeTypeValue, customName?: string, customCode?: string) => {
    const newId = `node_${Date.now()}`;
    const count = nodes.length;
    const posX = 120 + (count % 3) * 320;
    const posY = 150 + Math.floor(count / 3) * 220;

    const nodeTypeVal = presetType || ProcessNodeType.StandardStage;
    const label = customName || 'Novo Local de Análise';
    const codeVal = customCode || 'analise_' + Math.floor(Math.random() * 1000);

    const newNode: Node<WorkflowCustomNodeData> = {
      id: newId,
      type: 'workflowNode',
      position: { x: posX, y: posY },
      data: {
        id: newId,
        label,
        code: codeVal,
        nodeType: nodeTypeVal,
        fieldsCount: 0,
        isStart: false,
        onConfigure: handleOpenConfigureNode,
        onAddChild: handleAddChildToNode,
        onDelete: handleDeleteNode,
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

// Utilitário para validar formato UUID/GUID
const isGuid = (val?: string | null): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

  // Obter ou criar os Process Nodes necessários no backend para salvar a árvore com integridade total
  const ensureProcessNodeIds = async (targetAreaId: string): Promise<Record<string, string>> => {
    // 1. Sempre buscar catálogo atualizado do servidor para evitar conflitos de cache
    let freshNodes: ProcessNode[] = [];
    try {
      freshNodes = await workflowsApi.getNodesByAreaId(targetAreaId);
    } catch {
      freshNodes = [...availableCatalogNodes];
    }

    const resolvedIds: Record<string, string> = { ...nodeLocationMap };

    for (const n of nodes) {
      const explicitLocId = resolvedIds[n.id] || n.data.processNodeId;

      // 1. Se já tem um ID que é GUID e existe no catálogo da área
      if (explicitLocId && isGuid(explicitLocId)) {
        const found = freshNodes.find((cat) => cat.id.toLowerCase() === explicitLocId.toLowerCase());
        if (found) {
          resolvedIds[n.id] = found.id;
          continue;
        }
      }

      // 2. Se o próprio nó do canvas já tem ID em formato GUID e existe no catálogo
      if (isGuid(n.id)) {
        const found = freshNodes.find((cat) => cat.id.toLowerCase() === n.id.toLowerCase());
        if (found) {
          resolvedIds[n.id] = found.id;
          continue;
        }
      }

      // 3. Se for o nó inicial (Confecção / Abertura)
      if (n.data.isStart || n.data.nodeType === ProcessNodeType.StartConfection) {
        const confectionNode = freshNodes.find(
          (cat) =>
            cat.nodeType === ProcessNodeType.StartConfection ||
            cat.code.toLowerCase() === 'confeccao' ||
            cat.code.toLowerCase() === 'confeccao_inicial' ||
            cat.name.toLowerCase().includes('confec')
        );

        if (confectionNode) {
          resolvedIds[n.id] = confectionNode.id;
          continue;
        }
      }

      // 4. Buscar por código ou nome existente no catálogo da área
      const existingByCode = freshNodes.find(
        (cat) => cat.code.toLowerCase() === (n.data.code || '').trim().toLowerCase()
      );

      if (existingByCode) {
        resolvedIds[n.id] = existingByCode.id;
        continue;
      }

      const existingByNameAndType = freshNodes.find(
        (cat) =>
          cat.name.trim().toLowerCase() === n.data.label.trim().toLowerCase() &&
          cat.nodeType === n.data.nodeType
      );

      if (existingByNameAndType) {
        resolvedIds[n.id] = existingByNameAndType.id;
        continue;
      }

      // 5. Se não existe no banco, criar um novo ProcessNode com código único e sanitizado
      let rawCode = (n.data.code || n.data.label || 'etapa')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30);

      if (!rawCode) rawCode = 'etapa';

      let uniqueCode = rawCode;
      let counter = 1;
      while (freshNodes.some((fn) => fn.code.toLowerCase() === uniqueCode.toLowerCase())) {
        uniqueCode = `${rawCode.slice(0, 24)}_${Math.floor(100 + Math.random() * 900)}_${counter}`;
        counter++;
      }

      try {
        const created = await workflowsApi.createNode(targetAreaId, {
          name: n.data.label.trim() || 'Nova Etapa',
          code: uniqueCode,
          nodeType: n.data.nodeType,
          description: n.data.instructions?.trim() || undefined,
        });

        freshNodes.push(created);
        resolvedIds[n.id] = created.id;
      } catch (err: any) {
        // Se a criação falhou por colisão ou outro motivo, tenta fallback buscando nós existentes da área
        const fallback = freshNodes.find((cat) => cat.nodeType === n.data.nodeType) || freshNodes[0];
        if (fallback) {
          resolvedIds[n.id] = fallback.id;
        } else {
          throw new Error(
            `Não foi possível registrar o local de processo "${n.data.label}". ${err?.message || ''}`
          );
        }
      }
    }

    setAvailableCatalogNodes(freshNodes);
    setNodeLocationMap(resolvedIds);
    return resolvedIds;
  };

  // Salvar Árvore de Processo
  const handleSaveTree = async (exitAfterSave = false) => {
    if (!name.trim()) {
      setFeedback({ type: 'error', text: 'Informe o nome da árvore de processo.' });
      return;
    }
    if (!code.trim()) {
      setFeedback({ type: 'error', text: 'Informe o identificador da árvore de processo.' });
      return;
    }
    if (!areaId) {
      setFeedback({ type: 'error', text: 'Selecione a área responsável.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const locationIdsMap = await ensureProcessNodeIds(areaId);

      // Localizar nó raiz e garantir StartNodeId válido em formato GUID
      const rootNode = nodes.find((n) => n.data.isStart) || nodes[0];
      const startNodeId = locationIdsMap[rootNode?.id];

      if (!isGuid(startNodeId)) {
        throw new Error('Não foi possível identificar o local de processo da etapa inicial (Confecção).');
      }

      // Construir lista de nós com GUIDs válidos
      const nodesPayload: UpdateProcessTypePayload['nodes'] = [];
      nodes.forEach((n, idx) => {
        const resolvedGuid = locationIdsMap[n.id];
        if (isGuid(resolvedGuid)) {
          nodesPayload.push({
            processNodeId: resolvedGuid,
            order: idx + 1,
            instructions: nodeInstructionsMap[n.id]?.trim() || undefined,
          });
        }
      });

      if (nodesPayload.length === 0) {
        throw new Error('A árvore precisa conter pelo menos uma etapa de processo válida.');
      }

      // Construir campos da árvore vinculados a nós ou globais
      const allFieldsPayload: UpdateProcessTypePayload['fields'] = [];
      let displayOrderCounter = 1;

      Object.entries(nodeFieldsMap).forEach(([canvasNodeId, fieldConfigs]) => {
        const resolvedLocId = locationIdsMap[canvasNodeId];
        const validProcessNodeId = isGuid(resolvedLocId) ? resolvedLocId : undefined;

        fieldConfigs.forEach((fc) => {
          allFieldsPayload.push({
            fieldDefinitionId: fc.fieldDefinitionId,
            processNodeId: validProcessNodeId,
            isRequired: fc.isRequired,
            displayOrder: displayOrderCounter++,
            customLabel: fc.customLabel?.trim() || undefined,
            helpText: fc.helpText?.trim() || undefined,
            conditionsJson: fc.conditionsJson?.trim() || undefined,
          });
        });
      });

      // Construir transições garantindo GUIDs válidos em FromNodeId e ToNodeId
      const transitionsPayload = edges
        .map((e) => {
          const fromId = locationIdsMap[e.source];
          const toId = locationIdsMap[e.target];
          return {
            fromNodeId: fromId,
            toNodeId: toId,
            allowAdvance: true,
            allowReturn: true,
            allowRestart: true,
          };
        })
        .filter((t) => isGuid(t.fromNodeId) && isGuid(t.toNodeId));

      let savedProcessType: ProcessType;

      if (isEditing && treeId) {
        const payload: UpdateProcessTypePayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          targetAudience: targetAudience as any,
          startNodeId,
          nodes: nodesPayload,
          fields: allFieldsPayload,
          transitions: transitionsPayload,
        };
        savedProcessType = await workflowsApi.updateProcessType(treeId, payload);
        setFeedback({ type: 'success', text: 'Rascunho da árvore salvo com sucesso! O status permanece Em Criação.' });
      } else {
        const createPayload: CreateProcessTypePayload = {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || undefined,
          targetAudience: targetAudience as any,
          startNodeId,
        };
        const created = await workflowsApi.createProcessType(areaId, createPayload);

        const updatePayload: UpdateProcessTypePayload = {
          name: created.name,
          description: created.description,
          targetAudience: created.targetAudience,
          startNodeId,
          nodes: nodesPayload,
          fields: allFieldsPayload,
          transitions: transitionsPayload,
        };
        savedProcessType = await workflowsApi.updateProcessType(created.id, updatePayload);
        setFeedback({ type: 'success', text: 'Árvore criada e rascunho salvo com sucesso!' });

        if (!exitAfterSave) {
          navigate(`/app/workflows/trees/${savedProcessType.id}?areaId=${areaId}`, { replace: true });
        }
      }

      setCurrentProcessTypeForSimulation(savedProcessType);

      if (exitAfterSave) {
        setTimeout(() => {
          navigate(`/app/workflows?areaId=${areaId}`);
        }, 600);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar a árvore de processo.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Abrir Simulador de Debug
  const handleOpenSimulator = async () => {
    if (isEditing && treeId) {
      try {
        const full = await workflowsApi.getProcessTypeById(treeId);
        setCurrentProcessTypeForSimulation(full);
        setIsSimulatorOpen(true);
      } catch (err) {
        setFeedback({
          type: 'error',
          text: 'Salve as alterações da árvore antes de iniciar o simulador.',
        });
      }
    } else {
      setFeedback({
        type: 'error',
        text: 'Salve a árvore pela primeira vez para habilitar a simulação interativa.',
      });
    }
  };

  // Clonar Árvore para Nova Versão
  const handleCloneToNewVersion = async () => {
    if (!treeId || !window.confirm(`Deseja criar uma nova versão (v${versionNumber + 1}) clonando a estrutura atual desta árvore?`)) return;
    try {
      setSaving(true);
      const cloned = await workflowsApi.cloneProcessTypeVersion(treeId);
      setFeedback({ type: 'success', text: `Nova versão v${cloned.versionNumber} criada como rascunho!` });
      navigate(`/app/workflows/trees/${cloned.id}?areaId=${areaId}`);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao criar nova versão clonada.' });
    } finally {
      setSaving(false);
    }
  };

  // Iniciar Nova Versão do Zero
  const handleCreateNewVersionFromScratch = async () => {
    if (!treeId || !window.confirm(`Deseja iniciar uma nova versão (v${versionNumber + 1}) do zero para este processo?`)) return;
    try {
      setSaving(true);
      const newVersion = await workflowsApi.createNewVersionFromScratch(treeId);
      setFeedback({ type: 'success', text: `Nova versão v${newVersion.versionNumber} iniciada do zero!` });
      navigate(`/app/workflows/trees/${newVersion.id}?areaId=${areaId}`);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao criar nova versão do zero.' });
    } finally {
      setSaving(false);
    }
  };

  // Homologar Árvore
  const handleHomologate = async () => {
    if (
      !treeId ||
      !window.confirm(
        'Deseja homologar esta árvore para produção? Ela se tornará a versão oficial para abertura de chamados pela sede e unidades, e a versão homologada anterior será inativada.'
      )
    )
      return;
    try {
      await workflowsApi.homologateProcessType(treeId);
      setStatus(ProcessTypeStatus.Homologated);
      setFeedback({ type: 'success', text: 'Árvore homologada com sucesso para produção!' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao homologar a árvore.',
      });
    }
  };

  // Bloqueio de Exclusão do Nó Raiz no React Flow
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    const hasConfection = deletedNodes.some(
      (n) => n.data?.isStart || (n.data as any)?.nodeType === ProcessNodeType.StartConfection
    );
    if (hasConfection) {
      setFeedback({
        type: 'error',
        text: 'O nó inicial de Confecção é o ponto de partida obrigatório e está protegido contra exclusão.',
      });
    }
  }, []);

  // Dados do Nó atualmente selecionado no Modal Macro
  const activeSelectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedConfigNodeId);
  }, [nodes, selectedConfigNodeId]);

  const allProcessFieldsFlat = useMemo(() => {
    const list: NodeFieldItemConfig[] = [];
    Object.values(nodeFieldsMap).forEach((fields) => {
      fields.forEach((f) => {
        if (!list.some((item) => item.fieldDefinitionId === f.fieldDefinitionId)) {
          list.push(f);
        }
      });
    });
    return list;
  }, [nodeFieldsMap]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-xs font-semibold text-slate-500">
          Carregando Construtor Visual de Árvore de Processo...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col space-y-3.5">
      {/* 1. Header de Controle Superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/app/workflows?areaId=${areaId}`)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
            title="Voltar para a listagem de árvores"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <span className="text-xs font-medium text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              {isEditing ? `Parametrizar Árvore: ${name || 'Sem Título'}` : 'Nova Árvore de Processo'}
            </span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-700 border border-indigo-200">
              v{versionNumber}
            </span>
            {isHomologatedStatus(status) ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> Homologada (Ativa em Produção)
              </span>
            ) : isDraftStatus(status) ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                <Sparkles className="h-3 w-3" /> Em Criação / Rascunho
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-300">
                <History className="h-3 w-3" /> Inativa / Histórica
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Se estiver homologada, oferece criar nova versão */}
          {isEditing && isHomologatedStatus(status) && (
            <>
              <button
                type="button"
                onClick={handleCloneToNewVersion}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 shadow-xs"
              >
                <GitMerge className="h-4 w-4" />
                Nova Versão (Clonar)
              </button>
              <button
                type="button"
                onClick={handleCreateNewVersionFromScratch}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Nova Versão (Do Zero)
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleOpenSimulator}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Simular Fluxo
          </button>

          {/* Botão de Salvar apenas em modo Rascunho / Criação */}
          {isDraftStatus(status) && (
            <>
              <button
                type="button"
                onClick={() => handleSaveTree(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                title="Salvar rascunho mantendo o status Em Criação"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Rascunho
              </button>

              {isEditing && (
                <button
                  type="button"
                  onClick={handleHomologate}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm"
                  title="Homologar esta árvore para uso oficial em produção"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Homologar para Produção
                </button>
              )}
            </>
          )}

          {/* Botão de Sair durante a construção */}
          <button
            type="button"
            onClick={() => {
              if (isDraftStatus(status)) {
                const confirmed = window.confirm(
                  'Deseja sair do construtor de árvore? Você poderá retornar a qualquer momento para continuar a edição do seu rascunho.'
                );
                if (!confirmed) return;
              }
              navigate(`/app/workflows?areaId=${areaId}`);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
            title="Sair do construtor visual"
          >
            <LogOut className="h-4 w-4" />
            Sair da Construção
          </button>
        </div>
      </div>

      {/* Banner de Estado Homologado */}
      {isHomologatedStatus(status) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-3.5 shadow-sm text-emerald-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold">
                Versão Homologada e Ativa em Produção (v{versionNumber})
              </p>
              <p className="text-[11px] text-emerald-800">
                Esta árvore é a versão oficial em uso pela sede e unidades. Para alterar o fluxo com segurança, crie uma <strong>Nova Versão</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloneToNewVersion}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-300 shadow-xs hover:bg-emerald-100 transition"
            >
              <GitMerge className="h-3.5 w-3.5" />
              Criar Nova Versão (Clonar Base)
            </button>
            <button
              type="button"
              onClick={handleCreateNewVersionFromScratch}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-300 shadow-xs hover:bg-slate-50 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar Nova Versão (Do Zero)
            </button>
          </div>
        </div>
      )}

      {/* Banner de Estado Inativo / Arquivado */}
      {isArchivedStatus(status) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-slate-100 p-3.5 shadow-sm text-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-600 text-white shadow-xs">
              <History className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold">
                Versão Inativa / Histórica (v{versionNumber})
              </p>
              <p className="text-[11px] text-slate-600">
                Esta versão foi substituída por uma versão mais recente e permanece arquivada para histórico e auditoria.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloneToNewVersion}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 border border-indigo-200 shadow-xs hover:bg-indigo-50 transition"
          >
            <GitMerge className="h-3.5 w-3.5" />
            Restaurar como Base para Nova Versão
          </button>
        </div>
      )}

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-3 text-xs font-semibold shadow-sm transition-all ${
            feedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 2. Barra de Configurações Gerais da Árvore */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-700">
            Nome do Processo <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex: Análise de Contrato Comercial"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">
            Código / Identificador <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={isEditing}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            placeholder="PROC_CONTRATO"
            className="mt-1 w-full font-mono rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none disabled:opacity-75 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">
            Público-Alvo com Permissão de Abertura
          </label>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={ProcessAudience.All}>Ambos (Sede e Unidades)</option>
            <option value={ProcessAudience.HeadquartersOnly}>Exclusivo para Sede</option>
            <option value={ProcessAudience.UnitsOnly}>Exclusivo para Unidades / Filiais</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">
            Área Responsável
          </label>
          <select
            value={areaId}
            disabled={isEditing}
            onChange={(e) => setAreaId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Área Central do React Flow */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          fitView
          minZoom={0.2}
          maxZoom={1.8}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" />
          <Controls className="!rounded-xl !border-slate-200 !bg-white !shadow-md" />
          <MiniMap
            className="!rounded-xl !border-slate-200 !bg-white !shadow-md"
            nodeColor={(node) => {
              if (node.data?.nodeType === ProcessNodeType.StartConfection) return '#10b981';
              if (node.data?.nodeType === ProcessNodeType.ApprovalStage) return '#f59e0b';
              if (node.data?.nodeType === ProcessNodeType.EndArchived) return '#334155';
              return '#6366f1';
            }}
          />

          {/* Painel Superior Flutuante: Adicionar Nodos Rápidos */}
          <Panel position="top-left" className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddStandaloneNode()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" />
              + Nova Etapa
            </button>

            <button
              type="button"
              onClick={() =>
                handleAddStandaloneNode(
                  ProcessNodeType.EndArchived,
                  'Arquivamento - Deferido',
                  'arquivamento_deferido'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              + Arquivamento Deferido
            </button>

            <button
              type="button"
              onClick={() =>
                handleAddStandaloneNode(
                  ProcessNodeType.EndArchived,
                  'Arquivamento - Indeferido',
                  'arquivamento_indeferido'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              + Arquivamento Indeferido
            </button>
          </Panel>
        </ReactFlow>

        {/* 4. MODAL MACRO DE CONFIGURAÇÃO DO NÓ SELECIONADO */}
        {activeSelectedNode && (
          <NodeConfigMacroModal
            key={activeSelectedNode.id}
            nodeId={activeSelectedNode.id}
            nodeLabel={activeSelectedNode.data.label}
            nodeCode={activeSelectedNode.data.code}
            nodeType={activeSelectedNode.data.nodeType}
            isStart={activeSelectedNode.data.isStart}
            processNodeId={
              nodeLocationMap[activeSelectedNode.id] ||
              activeSelectedNode.data.processNodeId
            }
            instructions={
              nodeInstructionsMap[activeSelectedNode.id] ||
              activeSelectedNode.data.instructions
            }
            fields={nodeFieldsMap[activeSelectedNode.id] || []}
            availableCatalogNodes={availableCatalogNodes}
            availableCatalogFields={availableCatalogFields}
            allProcessFields={allProcessFieldsFlat}
            onClose={() => setSelectedConfigNodeId(null)}
            onSave={({
              nodeLabel,
              nodeCode,
              nodeType,
              processNodeId,
              instructions,
              fields,
            }) => {
              setNodes((currentNodes) =>
                currentNodes.map((n) => {
                  if (n.id === activeSelectedNode.id) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        label: nodeLabel,
                        code: nodeCode,
                        nodeType: nodeType as any,
                        processNodeId,
                        instructions,
                        fieldsCount: fields.length,
                      },
                    };
                  }
                  return n;
                })
              );

              if (processNodeId) {
                setNodeLocationMap((prev) => ({
                  ...prev,
                  [activeSelectedNode.id]: processNodeId,
                }));
              }
              setNodeInstructionsMap((prev) => ({
                ...prev,
                [activeSelectedNode.id]: instructions || '',
              }));
              setNodeFieldsMap((prev) => ({
                ...prev,
                [activeSelectedNode.id]: fields,
              }));

              setSelectedConfigNodeId(null);
              setFeedback({
                type: 'success',
                text: `Configurações aplicadas na etapa "${nodeLabel}" (${fields.length} campo(s) configurado(s)).`,
              });
            }}
          />
        )}
      </div>

      {/* Modal Simulador / Modo Debug */}
      {isSimulatorOpen && currentProcessTypeForSimulation && (
        <ProcessSimulatorModal
          processType={currentProcessTypeForSimulation}
          onClose={() => setIsSimulatorOpen(false)}
          onHomologate={
            currentProcessTypeForSimulation.status === ProcessTypeStatus.Draft
              ? () => handleHomologate()
              : undefined
          }
        />
      )}
    </div>
  );
};
