import { env } from '../../../app/config/env';
import { apiFetch } from '../../../shared/api';
import type { PagedPosts, Post, PostFormData } from '../types';

function formBody(data: PostFormData) {
  const body = new FormData();
  body.append('title', data.title);
  body.append('content', data.content);
  if (data.companyId) body.append('companyId', data.companyId);
  if (data.publishToAllCompanies) body.append('publishToAllCompanies', 'true');
  if (data.image) body.append('image', data.image);
  if (data.removeImage) body.append('removeImage', 'true');
  return body;
}

export function getPosts(options: { companyId?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (options.companyId) params.set('companyId', options.companyId);
  params.set('page', String(options.page ?? 1));
  params.set('pageSize', String(options.pageSize ?? 10));
  return apiFetch<PagedPosts>(`/api/posts?${params.toString()}`, { method: 'GET' });
}

export function createPost(data: PostFormData) {
  return apiFetch<Post>('/api/posts', { method: 'POST', body: formBody(data) });
}

export function updatePost(id: string, data: PostFormData) {
  return apiFetch<Post>(`/api/posts/${id}`, { method: 'PUT', body: formBody(data) });
}

export function deletePost(id: string) {
  return apiFetch<void>(`/api/posts/${id}`, { method: 'DELETE' });
}

export function setPostPinned(id: string, isPinned: boolean) {
  return apiFetch<Post>(`/api/posts/${id}/pin`, { method: 'PATCH', body: JSON.stringify({ isPinned }) });
}

export function postImageUrl(imageUrl?: string | null) {
  return imageUrl ? `${env.apiBaseUrl}${imageUrl}` : null;
}
