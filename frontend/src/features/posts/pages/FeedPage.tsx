import { Building2, ImagePlus, LoaderCircle, Pencil, Pin, Plus, RefreshCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { getCompanies } from '../../companies/api';
import type { Company } from '../../companies/types';
import { getAreasByCompanyId } from '../../areas/api';
import type { CompanyArea } from '../../areas/types';
import { getAccessesByUser } from '../../access-control/api';
import type { UserAreaAccess } from '../../access-control/types';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';
import { createPost, deletePost, getPosts, postImageUrl, setPostPinned, updatePost } from '../api';
import type { Post, PostFormData } from '../types';

const initialForm = {
  title: '',
  content: '',
  companyId: '',
  areaId: '',
  publishToAllCompanies: false,
  image: null as File | null,
  removeImage: false,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function FeedPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAreaParam = searchParams.get('areaId') || '';

  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;
  const isCompanyAdmin = user?.roles.includes(SystemRoles.CompanyAdmin) ?? false;
  const canModerateCompany = isSuperAdmin || isCompanyAdmin;

  const [posts, setPosts] = useState<Post[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(user?.companyId || '');

  const [areas, setAreas] = useState<CompanyArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(initialAreaParam);

  const [userAccesses, setUserAccesses] = useState<UserAreaAccess[]>([]);

  const [form, setForm] = useState(initialForm);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 1. Sincronizar selectedAreaId com searchParams da rota
  useEffect(() => {
    const areaParam = searchParams.get('areaId') || '';
    setSelectedAreaId(areaParam);
  }, [searchParams]);

  // 2. Carregar Empresas se SuperAdmin
  useEffect(() => {
    if (isSuperAdmin) {
      getCompanies()
        .then((data) => {
          const activeCompanies = data.filter((c) => c.isActive);
          setCompanies(activeCompanies);
          if (activeCompanies.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(activeCompanies[0].id);
          }
        })
        .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as empresas.'));
    } else if (user?.companyId) {
      setSelectedCompanyId(user.companyId);
    }
  }, [isSuperAdmin, user?.companyId]);

  // 3. Carregar Acessos do Usuário
  useEffect(() => {
    if (!isSuperAdmin && !isCompanyAdmin && user?.id) {
      getAccessesByUser(user.id)
        .then((data) => setUserAccesses(data.filter((a) => a.isActive)))
        .catch(() => setUserAccesses([]));
    }
  }, [isSuperAdmin, isCompanyAdmin, user?.id]);

  // 4. Carregar Áreas da Empresa
  useEffect(() => {
    if (!selectedCompanyId) {
      setAreas([]);
      return;
    }

    getAreasByCompanyId(selectedCompanyId)
      .then((data) => {
        const activeAreas = data.filter((a) => a.isActive);
        setAreas(activeAreas);
      })
      .catch(() => setAreas([]));
  }, [selectedCompanyId]);

  // 5. Carregar Posts
  const loadPosts = useCallback(async (targetPage = 1, append = false) => {
    try {
      setIsLoading(true);
      const response = await getPosts({
        companyId: isSuperAdmin ? selectedCompanyId || undefined : undefined,
        areaId: selectedAreaId || undefined,
        page: targetPage,
      });
      setPosts((current) => (append ? [...current, ...response.items] : response.items));
      setPage(response.page);
      setHasMore(response.hasMore);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as publicações.');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, selectedCompanyId, selectedAreaId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!form.image) {
      setImagePreview(null);
      return;
    }

    const url = URL.createObjectURL(form.image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.image]);

  // Áreas onde o usuário possui autorização para publicar
  const authorizedAreas = isSuperAdmin || isCompanyAdmin
    ? areas
    : areas.filter((a) => userAccesses.some((acc) => acc.areaId === a.id && (acc.canPublishInformatives || acc.canManage)));

  // Pode publicar no contexto atual ou se possuir qualquer área autorizada
  const canPublishInCurrentContext = isSuperAdmin || isCompanyAdmin || (
    selectedAreaId
      ? userAccesses.some((a) => a.areaId === selectedAreaId && (a.canPublishInformatives || a.canManage))
      : authorizedAreas.length > 0
  );

  function resetForm() {
    const isSelectedAuthorized = selectedAreaId && authorizedAreas.some((a) => a.id === selectedAreaId);
    const defaultArea = isSelectedAuthorized
      ? selectedAreaId
      : (authorizedAreas.length > 0 ? authorizedAreas[0].id : '');

    setForm({
      ...initialForm,
      companyId: isSuperAdmin ? selectedCompanyId : '',
      areaId: defaultArea,
    });
    setEditingPost(null);
  }

  function openComposer() {
    resetForm();
    setErrorMessage(null);
    setIsComposerOpen(true);
  }

  function closeComposer() {
    if (isSaving) return;
    resetForm();
    setIsComposerOpen(false);
  }

  function beginEdit(post: Post) {
    setEditingPost(post);
    setForm({
      title: post.title,
      content: post.content,
      companyId: post.companyId ?? '',
      areaId: post.areaId ?? '',
      publishToAllCompanies: post.isGlobal,
      image: null,
      removeImage: false,
    });
    setErrorMessage(null);
    setIsComposerOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSuperAdmin && !form.publishToAllCompanies && !(editingPost ? form.companyId : selectedCompanyId || form.companyId)) {
      setErrorMessage('Selecione a empresa ou marque a publicação para todas as empresas.');
      return;
    }

    const resolvedAreaId = form.areaId || selectedAreaId || (authorizedAreas.length > 0 ? authorizedAreas[0].id : undefined);

    if (!isSuperAdmin && !isCompanyAdmin && !resolvedAreaId) {
      setErrorMessage('Nenhuma área identificada para esta publicação.');
      return;
    }

    try {
      setIsSaving(true);
      const payload: PostFormData = {
        title: form.title,
        content: form.content,
        companyId: isSuperAdmin && !form.publishToAllCompanies
          ? (editingPost ? form.companyId : selectedCompanyId)
          : undefined,
        areaId: resolvedAreaId || undefined,
        publishToAllCompanies: isSuperAdmin && form.publishToAllCompanies,
        image: form.image,
        removeImage: form.removeImage,
      };

      if (editingPost) {
        await updatePost(editingPost.id, payload);
      } else {
        await createPost(payload);
      }

      closeComposer();
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

  const canModeratePost = (post: Post) => {
    if (isSuperAdmin) return true;
    if (canModerateCompany && !post.isGlobal) return true;
    if (post.areaId) {
      return userAccesses.some((a) => a.areaId === post.areaId && a.canManage);
    }
    return false;
  };

  const canEdit = (post: Post) => post.authorId === user?.id || canModeratePost(post);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Comunicação Interna</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Feed Corporativo & Informativos</h1>
          <p className="mt-1 text-xs text-slate-500">
            Acompanhe os comunicados e novidades publicados pelas áreas da sede.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCcw className="h-4 w-4" /> Atualizar
          </button>

          {canPublishInCurrentContext && (
            <button
              type="button"
              onClick={openComposer}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" /> Nova publicação
            </button>
          )}
        </div>
      </div>

      {/* Filtros de Empresa e Área */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {isSuperAdmin && companies.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Empresa:</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setSelectedAreaId('');
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-semibold text-slate-600">Filtrar por Área:</span>
          <select
            value={selectedAreaId}
            onChange={(e) => {
              setSelectedAreaId(e.target.value);
              if (e.target.value) {
                setSearchParams({ areaId: e.target.value });
              } else {
                setSearchParams({});
              }
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
          >
            <option value="">Todas as áreas (Geral)</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage && !isComposerOpen && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">{errorMessage}</div>
      )}

      {/* Lista de Posts */}
      <div className="space-y-4">
        {isLoading && posts.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
            Carregando publicações...
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">Ainda não há publicações nesta visualização.</p>
            <p className="mt-1 text-xs text-slate-500">
              {canPublishInCurrentContext
                ? 'Você pode ser a primeira pessoa a compartilhar um comunicado nesta área.'
                : 'Quando a equipe da área publicar novidades, elas aparecerão aqui.'}
            </p>
          </div>
        )}

        {posts.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {post.imageUrl && (
              <div className="flex max-h-[26rem] min-h-48 items-center justify-center bg-slate-100 p-3 sm:p-5">
                <img src={postImageUrl(post.imageUrl) ?? undefined} alt="Imagem da publicação" className="max-h-[24rem] max-w-full rounded-lg object-contain" />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {post.isPinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        <Pin className="h-3.5 w-3.5" />Fixado
                      </span>
                    )}
                    {post.areaName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
                        <Building2 className="w-3 h-3 text-indigo-500" />
                        {post.areaName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        Institucional Geral
                      </span>
                    )}
                    <p className="text-xs font-medium text-slate-400">{post.companyName}</p>
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">{post.title}</h2>
                </div>
                <div className="flex gap-1">
                  {canModeratePost(post) && (
                    <button type="button" aria-label="Alternar destaque" onClick={() => void togglePin(post)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                      <Pin className={`h-4 w-4 ${post.isPinned ? 'fill-amber-500 text-amber-600' : ''}`} />
                    </button>
                  )}
                  {canEdit(post) && (
                    <button type="button" aria-label="Editar" onClick={() => beginEdit(post)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canEdit(post) && (
                    <button type="button" aria-label="Excluir" onClick={() => void remove(post)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.content}</p>
              <p className="mt-4 text-xs text-slate-500">
                Por <span className="font-semibold text-slate-700">{post.authorName}</span>
                {post.authorAreaName ? ` (${post.authorAreaName})` : ''} · {formatDate(post.createdAt)}
                {post.updatedAt ? ' · editado' : ''}
              </p>
            </div>
          </article>
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <button type="button" disabled={isLoading} onClick={() => void loadPosts(page + 1, true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
            Carregar mais
          </button>
        </div>
      )}

      {/* Modal Composer */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="post-composer-title">
          <button type="button" onClick={closeComposer} className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs" aria-label="Fechar janela de publicação" />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 id="post-composer-title" className="text-lg font-bold text-slate-900">{editingPost ? 'Editar publicação' : 'Nova publicação'}</h2>
                <p className="mt-1 text-xs text-slate-500">Compartilhe um comunicado com os colaboradores da empresa.</p>
              </div>
              <button type="button" onClick={closeComposer} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={(event) => void submit(event)} className="p-6 space-y-4">
              {errorMessage && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 font-semibold">{errorMessage}</div>}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título:</label>
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                  placeholder="Ex: Novos procedimentos para solicitação de pareceres"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs shadow-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mensagem / Conteúdo:</label>
                <textarea
                  required
                  maxLength={5000}
                  value={form.content}
                  onChange={(event) => setForm((value) => ({ ...value, content: event.target.value }))}
                  placeholder="Escreva a sua mensagem detalhada..."
                  rows={6}
                  className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-xs shadow-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {isSuperAdmin && !editingPost && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input type="checkbox" checked={form.publishToAllCompanies} onChange={(event) => setForm((value) => ({ ...value, publishToAllCompanies: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  Publicar em todas as empresas
                </label>
              )}

              {imagePreview && <img src={imagePreview} alt="Prévia da imagem" className="mt-4 max-h-64 w-full rounded-xl bg-slate-100 object-contain border border-slate-200" />}
              {!imagePreview && editingPost?.imageUrl && !form.removeImage && <img src={postImageUrl(editingPost.imageUrl) ?? undefined} alt="Imagem atual" className="mt-4 max-h-64 w-full rounded-xl bg-slate-100 object-contain border border-slate-200" />}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
                  <ImagePlus className="h-4 w-4 text-indigo-600" />
                  {form.image ? form.image.name : 'Adicionar imagem'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setForm((value) => ({ ...value, image: event.target.files?.[0] ?? null, removeImage: false }))} />
                </label>
                {(form.image || (editingPost?.imageUrl && !form.removeImage)) && (
                  <button type="button" onClick={() => setForm((value) => ({ ...value, image: null, removeImage: true }))} className="text-xs font-semibold text-rose-600 hover:text-rose-700">
                    Remover imagem
                  </button>
                )}
                <button
                  disabled={isSaving}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 shadow-sm transition-colors"
                >
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {editingPost ? 'Salvar alterações' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
