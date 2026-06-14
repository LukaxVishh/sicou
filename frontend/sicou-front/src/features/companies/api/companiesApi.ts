import { apiFetch } from '../../../shared/api';
import type {
  Company,
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '../types';

export async function getCompanies() {
  return apiFetch<Company[]>('/api/companies', {
    method: 'GET',
  });
}

export async function getCompanyById(id: string) {
  return apiFetch<Company>(`/api/companies/${id}`, {
    method: 'GET',
  });
}

export async function createCompany(request: CreateCompanyRequest) {
  return apiFetch<Company>('/api/companies', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateCompany(id: string, request: UpdateCompanyRequest) {
  return apiFetch<Company>(`/api/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteCompany(id: string) {
  return apiFetch<void>(`/api/companies/${id}`, {
    method: 'DELETE',
  });
}