import { ImagePlus, LoaderCircle, Pencil, Pin, Plus, RefreshCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getCompanies } from '../../companies/api';
import type { Company } from '../../companies/types';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { createPost, deletePost, getPosts, postImageUrl, setPostPinned, updatePost } from '../api';
import type { Post, PostFormData } from '../types';

const initialForm = { title: '', content: '', companyId: '', publishToAllCompanies: false, image: null as File | null, removeImage: false };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function FeedPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;
  const canModerate = isSuperAdmin || (user?.roles.includes(SystemRoles.CompanyAdmin) ?? false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadPosts = useCallback(async (targetPage = 1, append = false) => {
    try {
      setIsLoading(true);
      const response = await getPosts({ companyId: isSuperAdmin ? selectedCompanyId || undefined : undefined, page: targetPage });
      setPosts((current) => append ? [...current, ...response.items] : response.items);
      setPage(response.page);
      setHasMore(response.hasMore);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as publicações.');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, selectedCompanyId]);

  useEffect(() => { void loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (!form.image) { setImagePreview(null); return; }
    const url = URL.createObjectURL(form.image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.image]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    getCompanies().then(setCompanies).catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as empresas.'));
  }, [isSuperAdmin]);

  function resetForm() {
    setForm({ ...initialForm, companyId: isSuperAdmin ? selectedCompanyId : '' });
    setEditingPost(null);
  }

  function beginEdit(post: Post) {
    setEditingPost(post);
    setForm({ title: post.title, content: post.content, companyId: post.companyId ?? '', publishToAllCompanies: post.isGlobal, image: null, removeImage: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSuperAdmin && !form.publishToAllCompanies && !(editingPost ? form.companyId : selectedCompanyId || form.companyId)) {
      setErrorMessage('Selecione a empresa ou marque a publicação para todas as empresas.');
      return;
    }
    try {
      setIsSaving(true);
      const payload: PostFormData = {
        title: form.title,
        content: form.content,
        companyId: isSuperAdmin && !form.publishToAllCompanies ? (editingPost ? form.companyId : selectedCompanyId) : undefined,
        publishToAllCompanies: isSuperAdmin && form.publishToAllCompanies,
        image: form.image,
        removeImage: form.removeImage,
      };
      if (editingPost) await updatePost(editingPost.id, payload);
      else await createPost(payload);
      resetForm();
      await loadPosts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar a publicação.');
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(post: Post) {
    if (!window.confirm(`Excluir “${post.title}”?`)) return;
    try {
      await deletePost(post.id);
      await loadPosts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível excluir a publicação.');
    }
  }

  async function togglePin(post: Post) {
    try {
      await setPostPinned(post.id, !post.isPinned);
      await loadPosts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o destaque.');
    }
  }

  const canModeratePost = (post: Post) => isSuperAdmin || (canModerate && !post.isGlobal);
  const canEdit = (post: Post) => post.authorId === user?.id || canModeratePost(post);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Comunicação interna</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Feed corporativo</h1>
          <p className="mt-2 text-sm text-slate-600">Compartilhe novidades e comunicados com sua empresa.</p>
        </div>
        <button type="button" onClick={() => void loadPosts()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <RefreshCcw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {isSuperAdmin && (
        <label className="mt-6 block text-sm font-semibold text-slate-700">Empresa exibida
          <select value={selectedCompanyId} onChange={(event) => { setSelectedCompanyId(event.target.value); }} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Todas as empresas</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
      )}

      <form onSubmit={(event) => void submit(event)} className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">{editingPost ? 'Editar publicação' : 'Publicar no feed'}</h2>{editingPost && <button type="button" onClick={resetForm} className="text-sm font-semibold text-slate-500 hover:text-slate-900"><X className="mr-1 inline h-4 w-4" />Cancelar</button>}</div>
        <input required maxLength={200} value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="Título do comunicado" className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea required maxLength={5000} value={form.content} onChange={(event) => setForm((value) => ({ ...value, content: event.target.value }))} placeholder="Escreva a sua mensagem..." rows={5} className="mt-3 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        {isSuperAdmin && !editingPost && (
          <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.publishToAllCompanies}
              onChange={(event) => setForm((value) => ({ ...value, publishToAllCompanies: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Publicar em todas as empresas
          </label>
        )}
        {isSuperAdmin && editingPost && <input type="hidden" value={form.companyId} />}
        {imagePreview && <img src={imagePreview} alt="Prévia da imagem" className="mt-3 max-h-56 w-full rounded-xl object-cover" />}
        {!imagePreview && editingPost?.imageUrl && !form.removeImage && <img src={postImageUrl(editingPost.imageUrl) ?? undefined} alt="Imagem atual" className="mt-3 max-h-56 w-full rounded-xl object-cover" />}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ImagePlus className="h-4 w-4" />{form.image ? form.image.name : 'Adicionar imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setForm((value) => ({ ...value, image: event.target.files?.[0] ?? null, removeImage: false }))} /></label>
          {(form.image || (editingPost?.imageUrl && !form.removeImage)) && <button type="button" onClick={() => setForm((value) => ({ ...value, image: null, removeImage: true }))} className="text-sm font-semibold text-rose-600 hover:text-rose-700">Remover imagem</button>}
          <button disabled={isSaving} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editingPost ? 'Salvar alterações' : 'Publicar'}</button>
        </div>
      </form>

      {errorMessage && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}

      <div className="mt-6 space-y-4">
        {isLoading && posts.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">Carregando publicações...</div> : null}
        {!isLoading && posts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><p className="font-semibold text-slate-700">Ainda não há publicações.</p><p className="mt-1 text-sm text-slate-500">Seja a primeira pessoa a compartilhar uma novidade.</p></div> : null}
        {posts.map((post) => <article key={post.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {post.imageUrl && (
            <div className="flex max-h-[26rem] min-h-48 items-center justify-center bg-slate-100 p-3 sm:p-5">
              <img
                src={postImageUrl(post.imageUrl) ?? undefined}
                alt="Imagem da publicação"
                className="max-h-[24rem] max-w-full rounded-lg object-contain"
              />
            </div>
          )}
          <div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2">{post.isPinned && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><Pin className="h-3.5 w-3.5" />Fixado</span>}<p className="text-xs font-medium text-slate-500">{post.companyName}</p></div><h2 className="mt-2 text-lg font-bold text-slate-900">{post.title}</h2></div><div className="flex gap-1">{canModeratePost(post) && <button type="button" aria-label="Alternar destaque" onClick={() => void togglePin(post)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pin className={`h-4 w-4 ${post.isPinned ? 'fill-amber-500 text-amber-600' : ''}`} /></button>}{canEdit(post) && <button type="button" aria-label="Editar" onClick={() => beginEdit(post)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}{canEdit(post) && <button type="button" aria-label="Excluir" onClick={() => void remove(post)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>}</div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.content}</p><p className="mt-4 text-xs text-slate-500">Por {post.authorName} · {formatDate(post.createdAt)}{post.updatedAt ? ' · editado' : ''}</p></div>
        </article>)}
      </div>

      {hasMore && <div className="mt-6 text-center"><button type="button" disabled={isLoading} onClick={() => void loadPosts(page + 1, true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Carregar mais</button></div>}
    </div>
  );
}
