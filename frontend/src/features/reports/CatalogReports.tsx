import { NativeSelectDropdown } from '../../shared/components/NativeSelectDropdown';
import { SystemEmptyState, SystemLoadingState, SystemNotice } from '../../shared/components';
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  download,
  emptyCatalogFilters,
  exportCatalog,
  getCatalog,
  getCatalogOptions,
  getOptions,
} from "./api";
import type {
  CatalogFilters,
  CatalogKind,
  CatalogOptions,
  CatalogResult,
  Option,
  ReportOptions,
} from "./api";

const input =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
const names: Record<CatalogKind, string> = {
  units: "Unidades",
  users: "Usuários",
  guides: "Orientações",
  movements: "Tramitações",
};
const descriptions: Record<CatalogKind, string> = {
  units: "Localização, situação e distribuição da equipe por unidade.",
  users: "Perfis, vínculos e situação dos usuários da empresa.",
  guides: "Publicações, categorias e anexos da base de conhecimento.",
  movements:
    "Cada movimentação dos processos: quem fez, quando, de qual etapa/unidade para qual e com que observação.",
};
const movementActions = [
  ["advance", "Avanço"],
  ["return", "Devolução"],
  ["restart", "Reinício"],
  ["transfer", "Transferência"],
  ["cancel", "Cancelamento"],
  ["comment", "Comentário"],
];
/** Colunas fora da tabela por padrão (continuam disponíveis no seletor e na exportação). */
const hiddenByDefault: Record<CatalogKind, string[]> = {
  units: [],
  users: [],
  guides: ["summary", "url", "updatedAt"],
  movements: ["company", "processType", "originUnit", "status", "currentStage"],
};
const roles = [
  ["SUPER_ADMIN", "Super Admin"],
  ["COMPANY_ADMIN", "Admin da Empresa"],
  ["AREA_ADMIN", "Gestor de Área"],
  ["HEADQUARTER_USER", "Usuário da Sede"],
  ["UNIT_USER", "Usuário da Unidade"],
];
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível consultar o relatório.";
const date = (value: string | number) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));

export function CatalogReports({ kind }: { kind: CatalogKind }) {
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<CatalogFilters>(emptyCatalogFilters);
  const [applied, setApplied] = useState<CatalogFilters>(emptyCatalogFilters);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [exporting, setExporting] = useState("");
  const [processOptions, setProcessOptions] = useState<ReportOptions | null>(
    null,
  );
  const movements = kind === "movements";
  useEffect(() => {
    if (!movements) return;
    const controller = new AbortController();
    // Tramitações usam o escopo de processos (setores/unidades com workflow), não o do Orientador.
    getOptions(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setProcessOptions(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setOptionsError(errorMessage(err));
      });
    return () => controller.abort();
  }, [movements, version]);
  useEffect(() => {
    const controller = new AbortController();
    getCatalogOptions(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOptions(data);
          setOptionsError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setOptionsError(errorMessage(err));
      });
    return () => controller.abort();
  }, [version]);
  useEffect(() => {
    const controller = new AbortController();
    getCatalog(kind, applied, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, applied, page, version]);
  const visibleKeys =
    selected ??
    result?.columns
      .filter((c) => !hiddenByDefault[kind].includes(c.key))
      .map((c) => c.key) ??
    [];
  const columns =
    result?.columns.filter((c) => visibleKeys.includes(c.key)) ?? [];
  const choices = (items: Option[] | undefined) =>
    (items ?? []).filter(
      (o) => !draft.companyId || o.companyId === draft.companyId,
    );
  const companies = movements ? processOptions?.companies : options?.companies;
  const areaChoices = choices(movements ? processOptions?.areas : options?.areas);
  const unitChoices = choices(movements ? processOptions?.units : options?.units);
  const categories = choices(options?.categories).filter(
    (o) => !draft.areaId || o.areaId === draft.areaId,
  );
  function prepareLoad() {
    setLoading(true);
    setError("");
    setResult(null);
  }
  function change(key: keyof CatalogFilters, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }
  async function handleExport(format: string) {
    setExporting(format);
    setError("");
    try {
      download(
        await exportCatalog(kind, applied, visibleKeys, format),
        `sicou-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting("");
    }
  }
  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          prepareLoad();
          setPage(1);
          setApplied({ ...draft });
        }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-slate-800">
              <Filter className="h-4 w-4 text-indigo-600" />
              Relatório de {names[kind].toLowerCase()}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{descriptions[kind]}</p>
          </div>
          <span className="text-xs text-slate-400">
            {movements ? "Data da movimentação · UTC" : "Datas de criação · UTC"}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-slate-600">
            Empresa
            <NativeSelectDropdown
              className={input}
              value={draft.companyId}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  companyId: e.target.value,
                  unitId: "",
                  areaId: "",
                  categoryId: "",
                }))
              }
            >
              <option value="">Todas as permitidas</option>
              {companies?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelectDropdown>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Buscar
            <input
              maxLength={200}
              className={input}
              placeholder={
                kind === "users"
                  ? "Nome ou e-mail"
                  : kind === "units"
                    ? "Nome ou código"
                    : movements
                      ? "Processo, título, usuário ou observação"
                      : "Título ou conteúdo"
              }
              value={draft.search}
              onChange={(e) => change("search", e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            {kind === "guides" ? "Publicação" : movements ? "Ação" : "Situação"}
            <NativeSelectDropdown
              className={input}
              value={draft.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="">Todas</option>
              {(kind === "guides"
                ? [
                    ["published", "Publicadas"],
                    ["draft", "Rascunhos permitidos"],
                  ]
                : movements
                  ? movementActions
                  : [
                    ["active", "Ativos"],
                    ["inactive", "Inativos"],
                  ]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSelectDropdown>
          </label>
          {kind !== "guides" && (
            <label className="text-xs font-semibold text-slate-600">
              Unidade
              <NativeSelectDropdown
                className={input}
                value={draft.unitId}
                onChange={(e) => change("unitId", e.target.value)}
              >
                <option value="">Todas</option>
                {unitChoices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelectDropdown>
            </label>
          )}
          {kind === "users" && (
            <label className="text-xs font-semibold text-slate-600">
              Perfil
              <NativeSelectDropdown
                className={input}
                value={draft.role}
                onChange={(e) => change("role", e.target.value)}
              >
                <option value="">Todos os perfis</option>
                {roles.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </NativeSelectDropdown>
            </label>
          )}
          {kind === "units" && (
            <>
              <label className="text-xs font-semibold text-slate-600">
                Cidade
                <input
                  maxLength={100}
                  className={input}
                  placeholder="Ex.: Cascavel"
                  value={draft.city}
                  onChange={(e) => change("city", e.target.value)}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                UF
                <input
                  maxLength={2}
                  className={input}
                  placeholder="Ex.: PR"
                  value={draft.state}
                  onChange={(e) =>
                    change("state", e.target.value.toUpperCase())
                  }
                />
              </label>
            </>
          )}
          {movements && (
            <label className="text-xs font-semibold text-slate-600">
              Setor
              <NativeSelectDropdown
                className={input}
                value={draft.areaId}
                onChange={(e) => change("areaId", e.target.value)}
              >
                <option value="">Todos os permitidos</option>
                {areaChoices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelectDropdown>
            </label>
          )}
          {kind === "guides" && (
            <>
              <label className="text-xs font-semibold text-slate-600">
                Setor
                <NativeSelectDropdown
                  className={input}
                  value={draft.areaId}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      areaId: e.target.value,
                      categoryId: "",
                    }))
                  }
                >
                  <option value="">Todos os permitidos</option>
                  {choices(options?.areas).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelectDropdown>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Categoria
                <NativeSelectDropdown
                  className={input}
                  value={draft.categoryId}
                  onChange={(e) => change("categoryId", e.target.value)}
                >
                  <option value="">Todas</option>
                  {categories.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelectDropdown>
              </label>
            </>
          )}
          <label className="text-xs font-semibold text-slate-600">
            Data inicial
            <input
              type="date"
              className={input}
              value={draft.startDate}
              max={draft.endDate || "9999-12-30"}
              onChange={(e) => change("startDate", e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Data final
            <input
              type="date"
              className={input}
              value={draft.endDate}
              min={draft.startDate}
              max="9999-12-30"
              onChange={(e) => change("endDate", e.target.value)}
            />
          </label>
          <div className="flex items-end gap-2">
            <button disabled={loading || !options} className={primary}>
              <Search className="h-4 w-4" />
              Aplicar
            </button>
            <button
              type="button"
              className={button}
              disabled={loading}
              onClick={() => {
                prepareLoad();
                setDraft(emptyCatalogFilters);
                setApplied({ ...emptyCatalogFilters });
                setPage(1);
              }}
            >
              Limpar
            </button>
          </div>
        </div>
      </form>
      {(error || optionsError) && (
        <SystemNotice>
          {error || optionsError}
          <button
            className="ml-3 underline"
            onClick={() => {
              prepareLoad();
              setVersion((v) => v + 1);
            }}
          >
            Tentar novamente
          </button>
        </SystemNotice>
      )}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{names[kind]}</h3>
            <p aria-live="polite" className="mt-1 text-sm text-slate-500">
              {loading
                ? "Consultando dados..."
                : `${result?.total ?? 0} registros encontrados`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!result}
              aria-expanded={showColumns}
              className={button}
              onClick={() => setShowColumns(!showColumns)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Colunas
            </button>
            {["pdf", "xlsx", "csv"].map((format) => (
              <button
                key={format}
                className={format === "xlsx" ? primary : button}
                disabled={
                  loading || !!exporting || !result || visibleKeys.length === 0
                }
                onClick={() => void handleExport(format)}
              >
                {format === exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {showColumns && result && (
          <fieldset className="flex flex-wrap gap-x-5 gap-y-3 border-b border-slate-100 bg-slate-50/60 p-5">
            <legend className="sr-only">
              Selecionar colunas da tabela e dos downloads
            </legend>
            {result.columns.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={visibleKeys.includes(c.key)}
                  disabled={
                    visibleKeys.length === 1 && visibleKeys.includes(c.key)
                  }
                  onChange={() =>
                    setSelected(
                      visibleKeys.includes(c.key)
                        ? visibleKeys.filter((key) => key !== c.key)
                        : [...visibleKeys, c.key],
                    )
                  }
                />
                {c.label}
              </label>
            ))}
          </fieldset>
        )}
        {loading ? (
          <SystemLoadingState label="Carregando relatório..." />
        ) : !result?.items.length ? (
          <SystemEmptyState icon={FileText} className="min-h-56" title={error ? 'Não foi possível carregar' : 'Nenhum registro neste recorte'} description={error ? 'Confira o aviso acima.' : 'Tente ajustar os filtros ou consultar outro período.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Relatório de {names[kind].toLowerCase()}
              </caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((c) => (
                    <th
                      scope="col"
                      key={c.key}
                      className="whitespace-nowrap px-5 py-4 font-semibold"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className="max-w-sm break-words px-5 py-4 text-slate-600"
                      >
                        {row.values[c.key] == null ||
                        row.values[c.key] === "" ? (
                          "—"
                        ) : c.type === "date" ? (
                          <span className="whitespace-nowrap">
                            {date(row.values[c.key]!)}
                          </span>
                        ) : c.key === "status" ? (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                            {row.values[c.key]}
                          </span>
                        ) : (
                          row.values[c.key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <p className="text-xs text-slate-500">
            PDF: até 1.000 registros · XLSX/CSV: até 5.000.
            {kind === "guides" &&
              " Resumos limitados a 500 caracteres; arquivos anexos não são incluídos."}
            {movements &&
              " Unidade filtra por origem do processo ou por transferências de/para ela."}
          </p>
          <div className="flex items-center gap-3">
            <button
              className={button}
              aria-label="Página anterior"
              disabled={loading || page === 1}
              onClick={() => {
                prepareLoad();
                setPage((p) => p - 1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-500">
              {page} / {Math.max(1, Math.ceil((result?.total ?? 0) / 25))}
            </span>
            <button
              className={button}
              aria-label="Próxima página"
              disabled={loading || !result || page * 25 >= result.total}
              onClick={() => {
                prepareLoad();
                setPage((p) => p + 1);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
