import { apiFetch } from '../../../shared/api';
import type {
  FieldDefinition,
  CreateFieldDefinitionPayload,
  UpdateFieldDefinitionPayload,
  ProcessNode,
  CreateProcessNodePayload,
  UpdateProcessNodePayload,
  ProcessType,
  ProcessTypeSummary,
  CreateProcessTypePayload,
  UpdateProcessTypePayload,
  ProcessInstance,
  ProcessInstanceSummary,
  CreateProcessInstancePayload,
  UpdateProcessDraftPayload,
  ProtocolProcessPayload,
  AdvanceProcessPayload,
  ReturnProcessPayload,
  RestartProcessPayload,
  AddProcessCommentPayload,
  CancelProcessPayload,
  TransferProcessPayload,
  ProcessSearchFilter,
} from '../types';

// --- Catálogo de Campos ---
export async function getFieldsByAreaId(areaId: string): Promise<FieldDefinition[]> {
  return apiFetch<FieldDefinition[]>(`/api/areas/${areaId}/fields`, { method: 'GET' });
}

export async function getFieldById(id: string): Promise<FieldDefinition> {
  return apiFetch<FieldDefinition>(`/api/fields/${id}`, { method: 'GET' });
}

export async function createField(
  areaId: string,
  payload: CreateFieldDefinitionPayload
): Promise<FieldDefinition> {
  return apiFetch<FieldDefinition>(`/api/areas/${areaId}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateField(
  id: string,
  payload: UpdateFieldDefinitionPayload
): Promise<FieldDefinition> {
  return apiFetch<FieldDefinition>(`/api/fields/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteField(id: string): Promise<void> {
  return apiFetch<void>(`/api/fields/${id}`, { method: 'DELETE' });
}

// --- Catálogo de Locais de Processos ---
export async function getNodesByAreaId(areaId: string): Promise<ProcessNode[]> {
  return apiFetch<ProcessNode[]>(`/api/areas/${areaId}/process-nodes`, { method: 'GET' });
}

export async function getNodeById(id: string): Promise<ProcessNode> {
  return apiFetch<ProcessNode>(`/api/process-nodes/${id}`, { method: 'GET' });
}

export async function createNode(
  areaId: string,
  payload: CreateProcessNodePayload
): Promise<ProcessNode> {
  return apiFetch<ProcessNode>(`/api/areas/${areaId}/process-nodes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateNode(
  id: string,
  payload: UpdateProcessNodePayload
): Promise<ProcessNode> {
  return apiFetch<ProcessNode>(`/api/process-nodes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteNode(id: string): Promise<void> {
  return apiFetch<void>(`/api/process-nodes/${id}`, { method: 'DELETE' });
}

// --- Árvores de Processos (ProcessType) ---
export async function getProcessTypesByAreaId(areaId: string): Promise<ProcessTypeSummary[]> {
  return apiFetch<ProcessTypeSummary[]>(`/api/areas/${areaId}/process-types`, { method: 'GET' });
}

export async function getProcessTypeById(id: string): Promise<ProcessType> {
  return apiFetch<ProcessType>(`/api/process-types/${id}`, { method: 'GET' });
}

export async function getAvailableProcessTypes(): Promise<ProcessTypeSummary[]> {
  return apiFetch<ProcessTypeSummary[]>('/api/process-types/available', { method: 'GET' });
}

export async function createProcessType(
  areaId: string,
  payload: CreateProcessTypePayload
): Promise<ProcessType> {
  return apiFetch<ProcessType>(`/api/areas/${areaId}/process-types`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProcessType(
  id: string,
  payload: UpdateProcessTypePayload
): Promise<ProcessType> {
  return apiFetch<ProcessType>(`/api/process-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function cloneProcessTypeVersion(id: string): Promise<ProcessType> {
  return apiFetch<ProcessType>(`/api/process-types/${id}/clone-version`, { method: 'POST' });
}

export async function createNewVersionFromScratch(id: string): Promise<ProcessType> {
  return apiFetch<ProcessType>(`/api/process-types/${id}/new-version-scratch`, { method: 'POST' });
}

export async function homologateProcessType(id: string): Promise<ProcessType> {
  return apiFetch<ProcessType>(`/api/process-types/${id}/homologate`, { method: 'POST' });
}

export async function inactivateProcessType(id: string): Promise<ProcessType> {
  return apiFetch<ProcessType>(`/api/process-types/${id}/inactivate`, { method: 'POST' });
}

export async function deleteProcessType(id: string): Promise<void> {
  return apiFetch<void>(`/api/process-types/${id}`, { method: 'DELETE' });
}

// --- Instâncias e Tramitação de Processos ---
function buildSearchQuery(status?: number | string, filter?: ProcessSearchFilter): string {
  const params = new URLSearchParams();
  if (status !== undefined && status !== '') params.set('status', String(status));
  if (filter) {
    if (filter.areaId) params.set('areaId', filter.areaId);
    if (filter.searchTerm) params.set('searchTerm', filter.searchTerm);
    if (filter.unitId) params.set('unitId', filter.unitId);
    if (filter.unitName) params.set('unitName', filter.unitName);
    if (filter.status !== undefined && filter.status !== '') params.set('status', String(filter.status));
    if (filter.creator) params.set('creator', filter.creator);
    if (filter.startDate) params.set('startDate', filter.startDate);
    if (filter.endDate) params.set('endDate', filter.endDate);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getAreaProcesses(
  areaId: string,
  status?: number,
  filter?: ProcessSearchFilter
): Promise<ProcessInstanceSummary[]> {
  const query = buildSearchQuery(status, filter);
  return apiFetch<ProcessInstanceSummary[]>(`/api/areas/${areaId}/processes${query}`, { method: 'GET' });
}

export async function searchProcesses(filter: ProcessSearchFilter): Promise<ProcessInstanceSummary[]> {
  const query = buildSearchQuery(undefined, filter);
  return apiFetch<ProcessInstanceSummary[]>(`/api/processes/search${query}`, { method: 'GET' });
}

export async function getMyProcesses(): Promise<ProcessInstanceSummary[]> {
  return apiFetch<ProcessInstanceSummary[]>('/api/processes/my', { method: 'GET' });
}

export async function getProcessById(id: string): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}`, { method: 'GET' });
}

export async function createProcess(payload: CreateProcessInstancePayload): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>('/api/processes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProcessDraft(
  id: string,
  payload: UpdateProcessDraftPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/draft`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function protocolProcess(
  id: string,
  payload: ProtocolProcessPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/protocol`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function advanceProcess(
  id: string,
  payload: AdvanceProcessPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/advance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function returnProcess(
  id: string,
  payload: ReturnProcessPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/return`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function restartProcess(
  id: string,
  payload: RestartProcessPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/restart`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addProcessComment(
  id: string,
  payload: AddProcessCommentPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function cancelProcess(
  id: string,
  payload: CancelProcessPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function transferProcess(
  id: string,
  payload: TransferProcessPayload
): Promise<ProcessInstance> {
  return apiFetch<ProcessInstance>(`/api/processes/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Atribuição de Usuários e Locais de Processos
export async function getMyProcessNodes(): Promise<ProcessNode[]> {
  return apiFetch<ProcessNode[]>('/api/users/me/process-nodes');
}

export async function getUserProcessNodes(userId: string): Promise<ProcessNode[]> {
  return apiFetch<ProcessNode[]>(`/api/users/${userId}/process-nodes`);
}

export async function assignUserProcessNodes(
  userId: string,
  processNodeIds: string[]
): Promise<ProcessNode[]> {
  return apiFetch<ProcessNode[]>(`/api/users/${userId}/process-nodes`, {
    method: 'PUT',
    body: JSON.stringify({ processNodeIds }),
  });
}

export async function getNodeAssignedUsers(processNodeId: string): Promise<any[]> {
  return apiFetch<any[]>(`/api/process-nodes/${processNodeId}/users`);
}

export async function assignNodeUsers(
  processNodeId: string,
  userIds: string[]
): Promise<any[]> {
  return apiFetch<any[]>(`/api/process-nodes/${processNodeId}/users`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  });
}
