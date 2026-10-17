import { NativeSelectDropdown } from '../../shared/components/NativeSelectDropdown';
import { SystemEmptyState, SystemLoadingState, SystemNotice } from '../../shared/components';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Newspaper,
  Inbox,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  Pin,
  ArrowUpRight,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../features/auth/providers';
import { getPosts, postImageUrl } from '../../features/posts/api';
import type { Post } from '../../features/posts/types';
import * as workflowsApi from '../../features/workflows/api';
import type { ProcessInstanceSummary } from '../../features/workflows/types';
import { ProcessStatus } from '../../features/workflows/types';
import { OpenProcessModal } from '../../features/workflows/components';

type ViewPreference = 'feed' | 'processes' | 'split';

const STORAGE_PREF_KEY = 'sicou_home_view_preference';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Preferência de visualização salva
  const [viewMode, setViewMode] = useState<ViewPreference>(() => {
    const saved = localStorage.getItem(STORAGE_PREF_KEY);
    return (saved as ViewPreference) || 'feed';
  });

  const [posts, setPosts] = useState<Post[]>([]);
  const [myProcesses, setMyProcesses] = useState<ProcessInstanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros da Fila de Solicitações
  const [processSearch, setProcessSearch] = useState('');
  const [processStatusFilter, setProcessStatusFilter] = useState<string>('all');

  // Modais e Painéis
  const [isOpenProcessModalOpen, setIsOpenProcessModalOpen] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState(false);

  // Carrega posts do Feed e Meus Processos
  const loadData = useCallback(async (isSilent = false) => {
    if (isSilent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [postsResponse, processesResponse] = await Promise.all([
        getPosts({ companyId: user?.companyId || undefined, page: 1, pageSize: 20 }).catch(() => ({
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 20,
          hasMore: false,
        })),
        workflowsApi.getMyProcesses().catch(() => []),
      ]);

      setPosts(postsResponse.items || []);
      setMyProcesses(processesResponse || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados da página inicial.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Salva preferência no LocalStorage
  const handleSaveDefaultPreference = (mode: ViewPreference) => {
    setViewMode(mode);
    localStorage.setItem(STORAGE_PREF_KEY, mode);
    setSavedSuccessMessage(true);
    setTimeout(() => setSavedSuccessMessage(false), 3000);
  };

  // Filtragem de Processos do Usuário
  const filteredProcesses = myProcesses.filter((p) => {
    const searchLower = processSearch.toLowerCase();
    const matchesSearch =
      p.processNumber.toLowerCase().includes(searchLower) ||
      p.processTypeName.toLowerCase().includes(searchLower) ||
      (p.title && p.title.toLowerCase().includes(searchLower)) ||
      p.currentNodeName.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (processStatusFilter === 'all') return true;
    if (processStatusFilter === 'review') return p.status === ProcessStatus.InReview;
    if (processStatusFilter === 'returned') return p.status === ProcessStatus.Returned;
    if (processStatusFilter === 'finished') return p.status === ProcessStatus.Finished;

    return true;
  });

  const processesInReview = myProcesses.filter((process) => process.status === ProcessStatus.InReview).length;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-6">
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#172554] px-6 py-7 text-white shadow-lg shadow-indigo-950/10 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-20 -top-32 -z-10 h-80 w-80 rounded-full border-[44px] border-white/[0.04]" />
        <div aria-hidden="true" className="absolute -bottom-36 right-44 -z-10 h-64 w-64 rounded-full border-[36px] border-white/[0.035]" />
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                Portal corporativo
              </span>
              {user?.unitId && (
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-indigo-100">
                  Unidade / Filial
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Olá, {user?.fullName || 'Colaborador'} <span className="text-indigo-300">👋</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100/80 sm:text-base">
              Acompanhe os comunicados da empresa e fique por dentro das suas solicitações.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-50"
              title="Atualizar página"
              aria-label="Atualizar página"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsOpenProcessModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" />
              Abrir solicitação
            </button>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 border-t border-white/15 pt-5 sm:grid-cols-3 sm:gap-6">
          <div className="flex items-center justify-between gap-4 sm:block">
            <span className="text-xs font-medium text-indigo-200">Comunicados recentes</span>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{loading ? '—' : posts.length}</p>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3 sm:block sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <span className="text-xs font-medium text-indigo-200">Minhas solicitações</span>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{loading ? '—' : myProcesses.length}</p>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3 sm:block sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <span className="text-xs font-medium text-indigo-200">Em análise</span>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{loading ? '—' : processesInReview}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-sm font-semibold text-slate-800">Sua área de trabalho</p>
          <p className="mt-0.5 text-xs text-slate-500">Escolha como prefere acompanhar as informações.</p>
        </div>
        <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-auto">
          {([
            { id: 'feed', label: 'Feed das áreas', icon: Newspaper },
            { id: 'processes', label: 'Solicitações', icon: Inbox },
            { id: 'split', label: 'Visão mista', icon: LayoutGrid },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleSaveDefaultPreference(id)}
              aria-pressed={viewMode === id}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition sm:flex-none ${
                viewMode === id
                  ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === 'processes' && <span className="text-[11px] opacity-70">{loading ? '—' : myProcesses.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {savedSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Sua preferência de visualização padrão foi salva com sucesso! Ao fazer login novamente, esta tela abrirá automaticamente.</span>
        </div>
      )}

      {error && (
        <SystemNotice>{error}</SystemNotice>
      )}

      {/* RENDERIZAÇÃO DO CONTEÚDO BASEADO NO MODO ESCOLHIDO */}
      {loading ? (
        <SystemLoadingState className="rounded-2xl border border-slate-200 bg-white shadow-sm" label="Carregando informações corporativas..." />
      ) : (
        <div className={viewMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-12 gap-6' : 'space-y-6'}>
          {/* SEÇÃO 1: FEED GERAL DAS ÁREAS DA EMPRESA */}
          {(viewMode === 'feed' || viewMode === 'split') && (
            <div className={`min-w-0 ${viewMode === 'split' ? 'lg:col-span-7 space-y-4' : 'space-y-4'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                    <Newspaper className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      Feed Geral da Empresa
                    </h2>
                    <p className="text-xs text-slate-500">
                      Últimos comunicados, avisos e orientações publicadas pelas áreas da sede.
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {posts.length} publicação{posts.length !== 1 ? 'ões' : ''}
                </span>
              </div>

              {posts.length === 0 ? (
                <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                    <Newspaper className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Nenhum comunicado recente</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    As áreas da sede ainda não publicaram comunicados nesta empresa.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => {
                    const postImg = postImageUrl(post.imageUrl);
                    return (
                      <article
                        key={post.id}
                        className={`bg-white rounded-2xl border p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md ${
                          post.isPinned ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
                        }`}
                      >
                        {/* Header do Post com Destaque da Área Publicadora */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            {/* Badge da Área da Sede */}
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <Building2 className="w-3.5 h-3.5" />
                              {post.areaName || post.authorAreaName || 'Sede Corporativa'}
                            </span>

                            {post.isPinned && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800">
                                <Pin className="w-3 h-3" /> Fixado
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {post.authorName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Conteúdo do Post */}
                        <div className="pt-4 space-y-2.5">
                          <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                            {post.title}
                          </h3>
                          <p className="text-sm text-slate-600 whitespace-pre-line leading-6">
                            {post.content}
                          </p>

                          {postImg && (
                            <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                              <img
                                src={postImg}
                                alt={post.title}
                                loading="lazy"
                                decoding="async"
                                className="mx-auto block h-auto max-h-[min(65svh,32rem)] w-full max-w-full object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SEÇÃO 2: MEUS PROCESSOS / SOLICITAÇÕES EM ACOMPANHAMENTO */}
          {(viewMode === 'processes' || viewMode === 'split') && (
            <div className={`min-w-0 ${viewMode === 'split' ? 'lg:col-span-5 space-y-4' : 'space-y-4'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      Minhas Solicitações
                    </h2>
                    <p className="text-xs text-slate-500">
                      Processos e chamados abertos por você em acompanhamento.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpenProcessModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova solicitação
                </button>
              </div>

              {/* Filtros Rápidos */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative min-w-0 flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={processSearch}
                    onChange={(e) => setProcessSearch(e.target.value)}
                    placeholder="Filtrar por protocolo ou assunto..."
                    className="w-full h-10 pl-9 pr-3 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>

                <NativeSelectDropdown
                  value={processStatusFilter}
                  onChange={(e) => setProcessStatusFilter(e.target.value)}
                  className="w-full sm:w-[190px] h-10 shrink-0"
                >
                  <option value="all">Todos os Status</option>
                  <option value="review">Em Análise</option>
                  <option value="returned">Devolvidos</option>
                  <option value="finished">Concluídos</option>
                </NativeSelectDropdown>
              </div>

              {/* Lista de Processos */}
              {filteredProcesses.length === 0 ? (
                <SystemEmptyState icon={Inbox} title="Nenhum processo encontrado" description="Você ainda não abriu chamados ou o filtro não retornou resultados." className="rounded-2xl border border-slate-200 bg-white shadow-sm" compact action={<button
                    onClick={() => setIsOpenProcessModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 border border-indigo-200"
                  >
                    <Plus className="w-3.5 h-3.5" /> Abrir Minha Primeira Solicitação
                  </button>} />
              ) : (
                <div className="space-y-3">
                  {filteredProcesses.map((proc) => {
                    const isFinished = proc.status === ProcessStatus.Finished;
                    const isReturned = proc.status === ProcessStatus.Returned;
                    return (
                      <div
                        key={proc.id}
                        onClick={() => navigate(`/app/workflows/processes/${proc.id}`)}
                        className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                            {proc.processNumber}
                          </span>

                          <div className="flex items-center gap-2">
                            {isFinished ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                Concluído
                              </span>
                            ) : isReturned ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Devolvido com Pendência
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Em Análise
                              </span>
                            )}
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-800 line-clamp-1">
                            {proc.processTypeName}
                          </p>
                          {proc.title && proc.title !== proc.processTypeName && (
                            <p className="text-[11px] text-slate-500 line-clamp-1">
                              {proc.title}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            Etapa: {proc.currentNodeName}
                          </span>
                          <span className="font-mono">
                            {new Date(proc.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Abertura de Novo Processo */}
      {isOpenProcessModalOpen && (
        <OpenProcessModal
          onClose={() => setIsOpenProcessModalOpen(false)}
          onCreated={() => {
            setIsOpenProcessModalOpen(false);
            loadData(true);
          }}
        />
      )}
    </div>
  );
};
