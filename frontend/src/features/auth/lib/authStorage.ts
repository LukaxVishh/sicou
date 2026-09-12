import { storageKeys } from '../../../shared/constants/storageKeys';
import type { AuthUser, LoginResponse } from '../types';

export function saveAuthSession(response: LoginResponse) {
  localStorage.setItem(storageKeys.accessToken, response.accessToken);
  localStorage.setItem(storageKeys.expiresAt, response.expiresAt);
  localStorage.setItem(storageKeys.user, JSON.stringify(response.user));
}

export function clearAuthSession() {
  localStorage.removeItem(storageKeys.accessToken);
  localStorage.removeItem(storageKeys.expiresAt);
  localStorage.removeItem(storageKeys.user);
}

export function getStoredUser(): AuthUser | null {
  const rawUser = localStorage.getItem(storageKeys.user);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem(storageKeys.accessToken);
}

export function getStoredExpiresAt() {
  return localStorage.getItem(storageKeys.expiresAt);
}

export function isStoredSessionExpired() {
  const expiresAt = getStoredExpiresAt();

  if (!expiresAt) {
    return true;
  }

  return new Date(expiresAt).getTime() <= Date.now();
}