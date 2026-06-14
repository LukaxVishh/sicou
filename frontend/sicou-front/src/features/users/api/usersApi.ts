import { apiFetch } from '../../../shared/api';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserRolesRequest,
  User,
} from '../types';

export async function getUsers() {
  return apiFetch<User[]>('/api/users', {
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