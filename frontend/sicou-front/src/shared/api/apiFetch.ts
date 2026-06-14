import { env } from '../../app/config/env';
import { storageKeys } from '../constants/storageKeys';

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

type ApiErrorBody = {
  message?: string;
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
};

function getStoredToken() {
  return localStorage.getItem(storageKeys.accessToken);
}

function buildHeaders(options?: ApiFetchOptions): HeadersInit {
  const token = getStoredToken();

  return {
    'Content-Type': 'application/json',
    ...(options?.auth !== false && token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...options?.headers,
  };
}

async function parseErrorMessage(response: Response) {
  const error = await response.json().catch(() => null) as ApiErrorBody | null;

  if (error?.message) {
    return error.message;
  }

  if (error?.title) {
    return error.title;
  }

  if (error?.detail) {
    return error.detail;
  }

  if (error?.errors) {
    const firstError = Object.values(error.errors).flat()[0];

    if (firstError) {
      return firstError;
    }
  }

  return 'Erro inesperado ao comunicar com a API.';
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<TResponse> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers: buildHeaders(options),
  });

  if (response.status === 401) {
    localStorage.removeItem(storageKeys.accessToken);
    localStorage.removeItem(storageKeys.expiresAt);
    localStorage.removeItem(storageKeys.user);

    window.location.href = '/login';

    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (response.status === 403) {
    throw new Error('Você não tem permissão para executar esta ação.');
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}