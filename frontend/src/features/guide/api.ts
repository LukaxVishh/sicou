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
export type GuideDocument = { text: string; tables: { name: string; rows: string[][] }[]; warnings: string[] };
export const previewGuideFile = (areaId: string, id: string) =>
  apiFetch<GuideDocument>(`${guidePath(areaId)}/items/${id}/preview`);
/** Arquivo autenticado como Blob, para exibir no navegador sem baixar. */
export async function getGuideFile(areaId: string, id: string, type: string, signal?: AbortSignal) {
  const response = await fetch(`${env.apiBaseUrl}${guidePath(areaId)}/items/${id}/file`, {
    headers: { Authorization: `Bearer ${localStorage.getItem(storageKeys.accessToken) ?? ''}` }, signal,
  });
  if (!response.ok) throw new Error('Não foi possível abrir o arquivo. Verifique sua sessão e permissão.');
  return new Blob([await response.arrayBuffer()], { type });
}
export async function downloadGuideFile(areaId: string, item: GuideItem) {
  const url = URL.createObjectURL(await getGuideFile(areaId, item.id, 'application/octet-stream'));
  const link = document.createElement('a');
  link.href = url;
  link.download = item.fileName ?? 'arquivo';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}