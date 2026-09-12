import { apiFetch } from '../../../shared/api';
import type { CreateUnitRequest, Unit, UpdateUnitRequest } from '../types';

export async function getUnitsByCompanyId(companyId: string) {
  return apiFetch<Unit[]>(`/api/companies/${companyId}/units`, {
    method: 'GET',
  });
}

export async function createUnit(companyId: string, request: CreateUnitRequest) {
  return apiFetch<Unit>(`/api/companies/${companyId}/units`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateUnit(unitId: string, request: UpdateUnitRequest) {
  return apiFetch<Unit>(`/api/units/${unitId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteUnit(unitId: string) {
  return apiFetch<void>(`/api/units/${unitId}`, {
    method: 'DELETE',
  });
}