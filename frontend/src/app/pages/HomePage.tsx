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
  AlertCircle,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../features/auth/providers';
import { getPosts, postImageUrl } from '../../features/posts/api';
import type { Post } from '../../features/posts/types';
import * as workflowsApi from '../../features/workflows/api';
import type { ProcessInstanceSummary } from '../../features/workflows/types';
import { ProcessStatus } from '../../features/workflows/types';
import { ProcessDetailsDrawer, OpenProcessModal } from '../../features/workflows/components';

type ViewPreference = 'feed' | 'processes' | 'split';

const STORAGE_PREF_KEY = 'sicou_home_view_preference';

export const HomePage: React.FC = () => {
  const { user } = useAuth();

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
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
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

  return (
    <div className="space-y-6">
      {/* Banner de Boas-Vindas e Seletor de Visão Personalizável */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              Portal Corporativo
            </span>
            {user?.unitId && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                Unidade / Filial
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">
            Olá, {user?.fullName || 'Colaborador'} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe comunicados das áreas da sede e gerencie suas solicitações operacionais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Modo de Exibição */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => handleSaveDefaultPreference('feed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'feed'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exibir Feed Corporativo das Áreas"
            >
              <Newspaper className="w-3.5 h-3.5" />
              Feed das Áreas
            </button>

            <button
              onClick={() => handleSaveDefaultPreference('processes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'processes'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exibir Meus Processos em Andamento"
            >
              <Inbox className="w-3.5 h-3.5" />
              Minhas Solicitações ({myProcesses.length})
            </button>

            <button
              onClick={() => handleSaveDefaultPreference('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'split'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Exibir Visão Integrada Lado a Lado"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Visão Mista
            </button>
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
            title="Atualizar Página"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            onClick={() => setIsOpenProcessModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Abrir Processo
          </button>
        </div>
      </div>

      {savedSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Sua preferência de visualização padrão foi salva com sucesso! Ao fazer login novamente, esta tela abrirá automaticamente.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* RENDERIZAÇÃO DO CONTEÚDO BASEADO NO MODO ESCOLHIDO */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm shadow-sm">
          Carregando informações corporativas...
        </div>
      ) : (
        <div className={viewMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-12 gap-6' : 'space-y-6'}>
          {/* SEÇÃO 1: FEED GERAL DAS ÁREAS DA EMPRESA */}
          {(viewMode === 'feed' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'lg:col-span-7 space-y-4' : 'space-y-4'}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
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

                <span className="text-xs font-semibold text-slate-400">
                  {posts.length} publicação{posts.length !== 1 ? 'ões' : ''}
                </span>
              </div>

              {posts.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm">
                  <Newspaper className="w-10 h-10 text-slate-300 mx-auto" />
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
                        className={`bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
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
                        <div className="pt-3 space-y-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {post.title}
                          </h3>
                          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                            {post.content}
                          </p>

                          {postImg && (
                            <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 max-h-96">
                              <img
                                src={postImg}
                                alt={post.title}
                                className="w-full h-full object-cover"
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
            <div className={viewMode === 'split' ? 'lg:col-span-5 space-y-4' : 'space-y-4'}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
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
                  <Plus className="w-3.5 h-3.5" /> + Nova Solicitação
                </button>
              </div>

              {/* Filtros Rápidos */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={processSearch}
                    onChange={(e) => setProcessSearch(e.target.value)}
                    placeholder="Filtrar por protocolo ou assunto..."
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={processStatusFilter}
                  onChange={(e) => setProcessStatusFilter(e.target.value)}
                  className="px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 shrink-0"
                >
                  <option value="all">Todos os Status</option>
                  <option value="review">Em Análise</option>
                  <option value="returned">Devolvidos</option>
                  <option value="finished">Concluídos</option>
                </select>
              </div>

              {/* Lista de Processos */}
              {filteredProcesses.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Nenhum processo encontrado</p>
                  <p className="text-[11px] text-slate-400">
                    Você ainda não abriu chamados ou o filtro não retornou resultados.
                  </p>
                  <button
                    onClick={() => setIsOpenProcessModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 border border-indigo-200"
                  >
                    <Plus className="w-3.5 h-3.5" /> Abrir Minha Primeira Solicitação
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProcesses.map((proc) => {
                    const isFinished = proc.status === ProcessStatus.Finished;
                    const isReturned = proc.status === ProcessStatus.Returned;
                    return (
                      <div
                        key={proc.id}
                        onClick={() => setSelectedProcessId(proc.id)}
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

      {/* Drawer de Detalhes e Acompanhamento do Processo */}
      {selectedProcessId && (
        <ProcessDetailsDrawer
          processId={selectedProcessId}
          onClose={() => setSelectedProcessId(null)}
          onRefresh={() => loadData(true)}
          canHandle={false}
        />
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
