import { apiFetch } from '../../../shared/api';
import type {
  CompanyArea,
  CreateAreaRequest,
  UpdateAreaModulesRequest,
  UpdateAreaRequest,
} from '../types';

export async function getAreasByCompanyId(companyId: string) {
  return apiFetch<CompanyArea[]>(`/api/companies/${companyId}/areas`, {
    method: 'GET',
  });
}

export async function createArea(
  companyId: string,
  request: CreateAreaRequest,
) {
  return apiFetch<CompanyArea>(`/api/companies/${companyId}/areas`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateArea(areaId: string, request: UpdateAreaRequest) {
  return apiFetch<CompanyArea>(`/api/areas/${areaId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function updateAreaModules(
  areaId: string,
  request: UpdateAreaModulesRequest,
) {
  return apiFetch<CompanyArea>(`/api/areas/${areaId}/modules`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteArea(areaId: string) {
  return apiFetch<void>(`/api/areas/${areaId}`, {
    method: 'DELETE',
  });
}