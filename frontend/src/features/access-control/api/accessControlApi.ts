import { apiFetch } from '../../../shared/api';
import type {
  CreateUserAreaAccessPayload,
  UpdateUserAreaAccessPayload,
  UserAreaAccess,
} from '../types';

export async function getAccessesByCompany(companyId: string) {
  return apiFetch<UserAreaAccess[]>(`/api/user-area-accesses/by-company/${companyId}`, {
    method: 'GET',
  });
}

export async function getAccessesByUser(userId: string) {
  return apiFetch<UserAreaAccess[]>(`/api/user-area-accesses/by-user/${userId}`, {
    method: 'GET',
  });
}

export async function getAccessById(id: string) {
  return apiFetch<UserAreaAccess>(`/api/user-area-accesses/${id}`, {
    method: 'GET',
  });
}

export async function createAccess(payload: CreateUserAreaAccessPayload) {
  return apiFetch<UserAreaAccess>('/api/user-area-accesses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAccess(
  id: string,
  payload: UpdateUserAreaAccessPayload,
) {
  return apiFetch<UserAreaAccess>(`/api/user-area-accesses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAccess(id: string) {
  return apiFetch<void>(`/api/user-area-accesses/${id}`, {
    method: 'DELETE',
  });
}
