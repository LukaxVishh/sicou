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