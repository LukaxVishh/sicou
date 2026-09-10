import { ArrowRight, Pin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getPosts } from '../api';
import type { Post } from '../types';

export function FeedSummary() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    getPosts({ pageSize: 3 }).then((response) => setPosts(response.items)).catch(() => setPosts([]));
  }, []);

  return (
    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div><p className="text-base font-semibold text-slate-900">Feed corporativo</p><p className="text-sm text-slate-500">Comunicados e novidades recentes</p></div>
        <Link to="/app/feed" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900">Ver feed <ArrowRight className="h-4 w-4" /></Link>
      </div>
      {posts.length === 0 ? <p className="px-6 py-8 text-sm text-slate-500">Nenhuma publicação recente.</p> : <div className="divide-y divide-slate-100">{posts.map((post) => <Link key={post.id} to="/app/feed" className="block px-6 py-4 hover:bg-slate-50"><div className="flex items-center gap-2">{post.isPinned && <Pin className="h-3.5 w-3.5 text-amber-600" />}<p className="font-semibold text-slate-900">{post.title}</p></div><p className="mt-1 line-clamp-1 text-sm text-slate-600">{post.content}</p><p className="mt-2 text-xs text-slate-500">{post.companyName} · {post.authorName}</p></Link>)}</div>}
    </section>
  );
}
