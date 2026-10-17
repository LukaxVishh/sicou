import { ArrowRight, Image as ImageIcon, Pin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getPosts, postImageUrl } from '../api';
import type { Post } from '../types';
import { SystemEmptyState } from '../../../shared/components';

export function FeedSummary() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    getPosts({ pageSize: 3 })
      .then((response) => setPosts(response.items))
      .catch(() => setPosts([]));
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Feed corporativo</h2>
          <p className="text-sm text-slate-500">Comunicados e novidades recentes</p>
        </div>

        <Link to="/app/feed" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          Ver feed <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {posts.length === 0 ? (
        <SystemEmptyState compact title="Nenhuma publicação recente" className="border-t border-slate-100" />
      ) : (
        <div className="divide-y divide-slate-100">
          {posts.map((post) => (
            <Link key={post.id} to="/app/feed" className="flex gap-4 px-6 py-4 hover:bg-slate-50">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                {post.imageUrl ? (
                  <img src={postImageUrl(post.imageUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {post.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                  <p className="truncate font-semibold text-slate-900">{post.title}</p>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.content}</p>
                <p className="mt-2 text-xs text-slate-500">{post.companyName} · {post.authorName}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
