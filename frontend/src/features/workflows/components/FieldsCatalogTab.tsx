import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Tag, Check, X, AlertCircle } from 'lucide-react';
import type { FieldDefinition, CreateFieldDefinitionPayload, UpdateFieldDefinitionPayload } from '../types';
import { FieldType } from '../types';
import * as workflowsApi from '../api';

interface FieldsCatalogTabProps {
  areaId: string;
  fields: FieldDefinition[];
  onRefresh: () => void;
  canManage: boolean;
}

const FIELD_TYPE_LABELS: Record<number, string> = {
  [FieldType.Text]: 'Texto Simples',
  [FieldType.TextArea]: 'Texto Longo (Área)',
  [FieldType.Number]: 'Numérico',
  [FieldType.Currency]: 'Valor Monetário (R$)',
  [FieldType.Cpf]: 'CPF',
  [FieldType.Cnpj]: 'CNPJ',
  [FieldType.Date]: 'Data',
  [FieldType.Select]: 'Seleção Única (Dropdown)',
  [FieldType.MultiSelect]: 'Múltipla Seleção',
  [FieldType.Boolean]: 'Sim / Não (Booleano)',
  [FieldType.FileAttachment]: 'Anexo de Arquivo',
};

export const FieldsCatalogTab: React.FC<FieldsCatalogTabProps> = ({
  areaId,
  fields,
  onRefresh,
  canManage,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [type, setType] = useState<number>(FieldType.Text);
  const [optionsStr, setOptionsStr] = useState('');

  const openCreateModal = () => {
    setEditingField(null);
    setCode('');
    setName('');
    setDescription('');
    setPlaceholder('');
    setType(FieldType.Text);
    setOptionsStr('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (field: FieldDefinition) => {
    setEditingField(field);
    setCode(field.code);
    setName(field.name);
    setDescription(field.description || '');
    setPlaceholder(field.placeholder || '');
    setType(field.type);
    if (field.globalOptionsJson) {
      try {
        const parsed = JSON.parse(field.globalOptionsJson);
        setOptionsStr(Array.isArray(parsed) ? parsed.join(', ') : field.globalOptionsJson);
      } catch {
        setOptionsStr(field.globalOptionsJson);
      }
    } else {
      setOptionsStr('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let optionsJson: string | undefined = undefined;
      if (type === FieldType.Select || type === FieldType.MultiSelect) {
        if (optionsStr.trim()) {
          const list = optionsStr.split(',').map((s) => s.trim()).filter(Boolean);
          optionsJson = JSON.stringify(list);
        }
      }

      if (editingField) {
        const payload: UpdateFieldDefinitionPayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          placeholder: placeholder.trim() || undefined,
          type: type as any,
          globalOptionsJson: optionsJson,
          isActive: editingField.isActive,
        };
        await workflowsApi.updateField(editingField.id, payload);
      } else {
        const payload: CreateFieldDefinitionPayload = {
          code: code.trim().toLowerCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          placeholder: placeholder.trim() || undefined,
          type: type as any,
          globalOptionsJson: optionsJson,
        };
        await workflowsApi.createField(areaId, payload);
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar campo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente desativar o campo "${name}"?`)) return;
    try {
      await workflowsApi.deleteField(id);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Erro ao desativar campo.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Catálogo de Campos Reutilizáveis
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Campos compartilhados cadastrados nesta área. Ao alterar um campo aqui, sua regra base reflete em todos os tipos de processos que o utilizam.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Campo
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nome do Campo</th>
                <th className="py-3 px-4">Tipo Primitivo</th>
                <th className="py-3 px-4">Descrição / Placeholder</th>
                <th className="py-3 px-4">Status</th>
                {canManage && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {fields.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-slate-400">
                    Nenhum campo cadastrado nesta área até o momento.
                  </td>
                </tr>
              ) : (
                fields.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {f.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {f.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {FIELD_TYPE_LABELS[f.type] || 'Desconhecido'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">
                      {f.description || f.placeholder || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {f.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                          <X className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(f)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Editar Campo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(f.id, f.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Desativar Campo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">
                {editingField ? 'Editar Campo Reutilizável' : 'Novo Campo Reutilizável'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Código de Identificação *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingField}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ex: cpf_cooperado"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome do Campo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: CPF do Cooperado"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tipo do Campo *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Placeholder (Texto Exemplo)
                  </label>
                  <input
                    type="text"
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="ex: Digite o número..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {(type === FieldType.Select || type === FieldType.MultiSelect) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Opções de Seleção (Separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    placeholder="ex: Opção 1, Opção 2, Opção 3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Descrição / Instrução de Preenchimento
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Orientações aos usuários sobre este dado..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Campo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
