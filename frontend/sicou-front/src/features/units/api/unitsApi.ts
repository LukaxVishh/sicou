import { apiFetch } from '../../../shared/api';
import type { CreateUnitRequest, Unit } from '../types';

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