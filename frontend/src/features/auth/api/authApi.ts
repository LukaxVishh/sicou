import { apiFetch } from '../../../shared/api';
import type { AuthUser, LoginRequest, LoginResponse } from '../types';

export async function login(request: LoginRequest) {
  return apiFetch<LoginResponse>('/api/Auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(request),
  });
}

export async function getCurrentUser() {
  return apiFetch<AuthUser>('/api/Auth/me', {
    method: 'GET',
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<LoginResponse>('/api/Auth/change-password', {
    method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
  });
}
