import React from 'react';
import { Plus, Edit2, Trash2, Tag, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { FieldDefinition } from '../types';
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
  const navigate = useNavigate();

  const handleOpenCreate = () => {
    navigate(`/app/workflows/fields/new?areaId=${areaId}`);
  };

  const handleOpenEdit = (field: FieldDefinition) => {
    navigate(`/app/workflows/fields/${field.id}?areaId=${areaId}`);
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
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm text-xs font-bold"
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
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 text-xs">
                      {f.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 text-xs">
                      {f.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {FIELD_TYPE_LABELS[f.type] || 'Desconhecido'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">
                      {f.description || f.placeholder || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {f.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                          <X className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(f)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar Campo na Página Dedicada"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(f.id, f.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
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
    </div>
  );
};
