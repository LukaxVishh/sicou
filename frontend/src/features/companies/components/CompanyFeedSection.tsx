import {
  FileText,
  Pin,
  RefreshCcw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getPosts, postImageUrl, setPostPinned } from '../../posts/api';
import type { Post } from '../../posts/types';
import { useAuth } from '../../auth/providers';
import { SystemRoles } from '../../../shared/constants/roles';

type CompanyFeedSectionProps = {
  companyId: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function CompanyFeedSection({ companyId }: CompanyFeedSectionProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(SystemRoles.SuperAdmin) ?? false;
  const isCompanyAdmin = user?.roles.includes(SystemRoles.CompanyAdmin) && user.companyId === companyId;
  const canModerate = isSuperAdmin || isCompanyAdmin;

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPosts = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const response = await getPosts({
        companyId,
        page: 1,
      });
      setPosts(response.items);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível carregar os comunicados.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function handleTogglePin(post: Post) {
    try {
      await setPostPinned(post.id, !post.isPinned);
      await loadPosts({ silent: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível alterar o destaque do comunicado.',
      );
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Feed & Comunicados da Empresa
            </h2>
            <p className="text-sm text-slate-500">
              {posts.length} comunicado(s) divulgado(s) pelas áreas da sede
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadPosts({ silent: true })}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Carregando comunicados do feed...
        </div>
      ) : posts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Ainda não há comunicados publicados para esta empresa.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Os gestores e publicadores das áreas da sede podem emitir informativos institucionais a qualquer momento.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.map((post) => (
            <article
              key={post.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {post.isPinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        <Pin className="h-3.5 w-3.5 fill-amber-600" />
                        Fixado
                      </span>
                    )}
                    <span className="inline-flex rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {post.isGlobal ? 'Comunicado Global' : post.companyName}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-bold text-slate-900">
                    {post.title}
                  </h3>
                </div>

                {canModerate && (
                  <button
                    type="button"
                    onClick={() => void handleTogglePin(post)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-amber-600"
                    title={post.isPinned ? 'Desafixar comunicado' : 'Fixar comunicado'}
                  >
                    <Pin className={`h-4 w-4 ${post.isPinned ? 'fill-amber-500 text-amber-600' : ''}`} />
                  </button>
                )}
              </div>

              {post.imageUrl && (
                <div className="mt-3 overflow-hidden rounded-lg bg-slate-100">
                  <img
                    src={postImageUrl(post.imageUrl) ?? undefined}
                    alt="Imagem do comunicado"
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              )}

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {post.content}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                <span>Por <strong className="font-semibold text-slate-700">{post.authorName}</strong></span>
                <span>{formatDate(post.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
