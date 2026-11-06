import { apiFetch } from '../../../shared/api';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserRolesRequest,
  User,
  UserTransfer,
} from '../types';

/** Histórico de transferências de unidade/empresa do usuário (RF-010). */
export async function getUserTransfers(userId: string) {
  return apiFetch<UserTransfer[]>(`/api/users/${userId}/transfers`, {
    method: 'GET',
  });
}

export async function getUsers() {
  return apiFetch<User[]>('/api/users', {
    method: 'GET',
  });
}

export async function getUserById(userId: string) {
  return apiFetch<User>(`/api/users/${userId}`, {
    method: 'GET',
  });
}

export async function createUser(request: CreateUserRequest) {
  return apiFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateUser(userId: string, request: UpdateUserRequest) {
  return apiFetch<User>(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function updateUserRoles(
  userId: string,
  request: UpdateUserRolesRequest,
) {
  return apiFetch<User>(`/api/users/${userId}/roles`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteUser(userId: string) {
  return apiFetch<void>(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}