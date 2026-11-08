import { apiFetch } from '../../shared/api/apiFetch';

export type IntegrationScope = { scope: string; description: string };

export type IntegrationTokenStatus = 'Active' | 'Expired' | 'Revoked' | 'Invalidated';

export type IntegrationToken = {
  id: string;
  name: string;
  externalSystem: string;
  tokenPrefix: string;
  companyId: string;
  companyName: string;
  createdByUserId: string;
  createdByName: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  renewedAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  status: IntegrationTokenStatus;
};

export type CreatedIntegrationToken = IntegrationToken & { token: string };

export type CreateIntegrationTokenInput = {
  name: string;
  externalSystem: string;
  scopes: string[];
  /** Obrigatório para Super Admin/Desenvolvedor: empresa selecionada no seletor corporativo. */
  companyId?: string;
};

export type IntegrationCall = {
  id: string;
  tokenId: string;
  tokenName: string;
  method: string;
  route: string;
  processInstanceId: string | null;
  statusCode: number;
  durationMs: number;
  createdAt: string;
};

export type IntegrationCallPage = {
  total: number;
  page: number;
  pageSize: number;
  callsLast7Days: number;
  errorsLast7Days: number;
  items: IntegrationCall[];
};

export const getIntegrationScopes = () => apiFetch<IntegrationScope[]>('/api/integrations/scopes');
export const getIntegrationTokens = (companyId?: string) =>
  apiFetch<IntegrationToken[]>(`/api/integrations/tokens${companyId ? `?companyId=${companyId}` : ''}`);

export const createIntegrationToken = (input: CreateIntegrationTokenInput) =>
  apiFetch<CreatedIntegrationToken>('/api/integrations/tokens', { method: 'POST', body: JSON.stringify(input) });

export const renewIntegrationToken = (id: string) =>
  apiFetch<CreatedIntegrationToken>(`/api/integrations/tokens/${id}/renew`, { method: 'POST' });

export const revokeIntegrationToken = (id: string) =>
  apiFetch<void>(`/api/integrations/tokens/${id}`, { method: 'DELETE' });

export function getIntegrationCalls(page: number, pageSize: number, tokenId?: string) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (tokenId) query.set('tokenId', tokenId);
  return apiFetch<IntegrationCallPage>(`/api/integrations/calls?${query.toString()}`);
}
