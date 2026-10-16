import React, { useState, useEffect } from 'react';
import { X, Search, Check, Users, Shield, AlertCircle } from 'lucide-react';
import type { ProcessNode } from '../types';
import * as workflowsApi from '../api';
import { getUsers } from '../../users/api';
import type { User } from '../../users/types';

interface AssignNodeUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: ProcessNode | null;
  companyId?: string | null;
}

export const AssignNodeUsersModal: React.FC<AssignNodeUsersModalProps> = ({
  isOpen,
  onClose,
  node,
  companyId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !node) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const [usersList, assignedList] = await Promise.all([
          getUsers().catch(() => [] as User[]),
          workflowsApi.getNodeAssignedUsers(node!.id).catch(() => [] as any[]),
        ]);

        if (!isMounted) return;
        setAllUsers(usersList.filter((u) => u.isActive && (!companyId || u.companyId === companyId)));
        setAssignedUserIds(assignedList.map((u) => u.id));
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'Erro ao carregar colaboradores vinculados ao local.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, node, companyId]);

  if (!isOpen || !node) return null;

  const handleToggleUser = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await workflowsApi.assignNodeUsers(node.id, assignedUserIds);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar atribuições.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden animate-fadeIn flex flex-col max-h-[85vh]">
        {/* Header Delicado */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl ring-1 ring-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Atribuir Colaboradores ao Local de Processo
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Local: <strong className="text-slate-800">{node.name}</strong> ({node.code})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informação e Instrução com Ênfase Delicada */}
        <div className="px-6 py-3 bg-indigo-50/40 border-b border-indigo-100/60 flex items-start gap-2.5 text-xs text-indigo-950">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px] text-slate-600">
            Apenas os colaboradores marcados abaixo poderão <strong>manipular (avançar, devolver ou reiniciar)</strong> processos quando estiverem nesta instância. Demais usuários poderão consultar o histórico e dados, mas sem permissão de ação.
          </p>
        </div>

        {/* Barra de Pesquisa */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador por nome ou e-mail..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-slate-800"
            />
          </div>
        </div>

        {/* Lista de Colaboradores */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Carregando colaboradores...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhum colaborador encontrado para a busca informada.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isAssigned = assignedUserIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => handleToggleUser(u.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                    isAssigned
                      ? 'bg-indigo-50/60 border-indigo-200/80 shadow-2xs'
                      : 'bg-white border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isAssigned
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{u.fullName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3">
                    {u.roles && u.roles.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60">
                        {u.roles[0]}
                      </span>
                    )}
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => handleToggleUser(u.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Feedback de Erro ou Sucesso */}
        {error && (
          <div className="px-6 py-2 bg-rose-50 border-t border-rose-100 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="px-6 py-2 bg-emerald-50 border-t border-emerald-100 text-emerald-800 text-xs flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Atribuições salvas com sucesso!</span>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-medium">
            <strong className="text-indigo-700 font-bold">{assignedUserIds.length}</strong>{' '}
            {assignedUserIds.length === 1 ? 'colaborador atribuído' : 'colaboradores atribuídos'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? 'Salvando...' : 'Salvar Atribuições'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
