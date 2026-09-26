import { apiFetch } from '../../shared/api';
import { env } from '../../app/config/env';
import { storageKeys } from '../../shared/constants/storageKeys';

export type GuideCategory = { id: string; name: string; sortOrder: number };
export type GuideItem = {
  id: string; categoryId: string; title: string; content: string; url: string | null;
  sortOrder: number; isPublished: boolean; fileName: string | null;
  createdAt: string; updatedAt: string | null;
};
export type GuideData = { canManage: boolean; categories: GuideCategory[]; items: GuideItem[] };
export type GuideArea = { id: string; name: string; companyId: string; companyName: string };
export const guidePath = (areaId: string) => `/api/areas/${areaId}/guide`;
export const getGuide = (areaId: string) => apiFetch<GuideData>(guidePath(areaId));
export const getGuideAreas = () => apiFetch<GuideArea[]>('/api/guide/areas');
export async function mutateGuide<T>(areaId: string, path: string, method: string, data?: unknown) {
  return apiFetch<T>(`${guidePath(areaId)}/${path}`, {
    method, body: data === undefined ? undefined : JSON.stringify(data),
  });
}
export async function uploadGuideFile(areaId: string, id: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  return apiFetch<void>(`${guidePath(areaId)}/items/${id}/file`, { method: 'POST', body });
}
export async function downloadGuideFile(areaId: string, item: GuideItem) {
  const response = await fetch(`${env.apiBaseUrl}${guidePath(areaId)}/items/${item.id}/file`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(storageKeys.accessToken) ?? ''}` },
  });
  if (!response.ok) throw new Error('Não foi possível baixar o arquivo. Verifique sua sessão e permissão.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = item.fileName ?? 'arquivo';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}