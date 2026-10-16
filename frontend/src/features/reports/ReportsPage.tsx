import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/providers";
import { CatalogReports } from "./CatalogReports";
import { ImportWorkspace } from "./ImportWorkspace";
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  FileText,
  Filter,
  Loader2,
  Search,
  SlidersHorizontal,
  Upload,
  Users,
  X,
  Building2,
  BookOpen,
} from "lucide-react";
import {
  assignResponsible,
  columns,
  download,
  emptyFilters,
  exportReport,
  getAssignmentOptions,
  getOptions,
  getReport,
  processDocument,
} from "./api";
import type {
  ColumnKey,
  Filters,
  Option,
  ProcessedDocument,
  ReportOptions,
  ReportResult,
  ReportRow,
  CatalogKind,
} from "./api";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
const statuses = [
  ["Draft", "Rascunho"],
  ["InReview", "Em análise"],
  ["Returned", "Devolvido"],
  ["Approved", "Aprovado"],
  ["Rejected", "Rejeitado"],
  ["Finished", "Concluído"],
  ["AdministrativeCancellation", "Cancelado administrativamente"],
];
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
const message = (err: unknown) =>
  err instanceof Error ? err.message : "Não foi possível concluir a operação.";

export function ReportsPage() {
  const [tab, setTab] = useState<"reports" | "documents" | CatalogKind>(
    "reports",
  );
  const { user } = useAuth();
  const isAdmin = user?.roles.some((role) =>
    ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(role),
  );
  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Dados e documentos
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Relatórios
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Transforme os dados da sua equipe em informação. Filtre,
              personalize e leve os dados com você.
            </p>
          </div>
        </div>
      </header>
      <div aria-label="Seções de relatórios" className="flex flex-wrap gap-2">
        <button
          aria-pressed={tab === "reports"}
          onClick={() => setTab("reports")}
          className={tab === "reports" ? primary : secondary}
        >
          <BarChart3 className="h-4 w-4" />
          Processos
        </button>
        {(
          [
            { key: "units", label: "Unidades", icon: Building2 },
            { key: "users", label: "Usuários", icon: Users },
            { key: "guides", label: "Orientações", icon: BookOpen },
          ] as const
        )
          .filter((item) => isAdmin || item.key === "guides")
          .map((item) => (
            <button
              key={item.key}
              aria-pressed={tab === item.key}
              className={tab === item.key ? primary : secondary}
              onClick={() => setTab(item.key)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        <button
          aria-pressed={tab === "documents"}
          onClick={() => setTab("documents")}
          className={tab === "documents" ? primary : secondary}
        >
          <FileSearch className="h-4 w-4" />
          Importar dados
        </button>
      </div>
      {tab === "reports" ? (
        <ProcessReports />
      ) : tab === "documents" ? (
        <ImportWorkspace extraction={<DocumentPanel />} />
      ) : (
        <CatalogReports key={tab} kind={tab} />
      )}
    </section>
  );
}

function ProcessReports() {
  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<ColumnKey[]>([
    "number",
    "title",
    "area",
    "unit",
    "status",
    "responsible",
    "createdAt",
  ]);
  const [showColumns, setShowColumns] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ReportRow | null>(null);
  const [responsible, setResponsible] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentOptions, setAssignmentOptions] = useState<Option[]>([]);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const assignmentDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!editing) {
      assignmentDialog.current?.close();
      return;
    }
    assignmentDialog.current?.showModal();
    const controller = new AbortController();
    getAssignmentOptions(editing.id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setAssignmentOptions(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setAssignmentError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAssignment(false);
      });
    return () => controller.abort();
  }, [editing]);
  useEffect(() => {
    const controller = new AbortController();
    getOptions(controller.signal)
      .then(setOptions)
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      });
    return () => controller.abort();
  }, [version]);
  useEffect(() => {
    const controller = new AbortController();
    getReport(applied, [], page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applied, page, version]);

  const companyOptions = (items: ReportOptions["areas"]) =>
    items.filter(
      (item) => !draft.companyId || item.companyId === draft.companyId,
    );
  const filteredBy = Object.values(applied).filter(Boolean).length;
  const displayed = columns.filter((c) => selected.includes(c.key));
  function prepareLoad() {
    setLoading(true);
    setResult(null);
    setError("");
  }

  async function handleExport(format: string) {
    setExporting(format);
    setError("");
    try {
      download(
        await exportReport(applied, selected, format),
        `sicou-processos-${new Date().toISOString().slice(0, 10)}.${format}`,
      );
    } catch (err) {
      setError(message(err));
    } finally {
      setExporting("");
    }
  }
  async function saveAssignment() {
    if (!editing) return;
    setSaving(true);
    setAssignmentError("");
    try {
      await assignResponsible(editing.id, responsible || null);
      setEditing(null);
      prepareLoad();
      setVersion((v) => v + 1);
    } catch (err) {
      setAssignmentError(message(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          prepareLoad();
          setApplied({ ...draft });
          setPage(1);
        }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Filter className="h-4 w-4 text-indigo-600" />
          Filtrar processos
          <span className="ml-auto text-xs font-normal text-slate-400">
            Período de criação · UTC
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            Empresa
            <select
              value={draft.companyId}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  companyId: e.target.value,
                  areaId: "",
                  unitId: "",
                  responsibleUserId: "",
                })
              }
              className={input}
            >
              <option value="">Todas as permitidas</option>
              {options?.companies.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            Setor
            <select
              value={draft.areaId}
              onChange={(e) => setDraft({ ...draft, areaId: e.target.value })}
              className={input}
            >
              <option value="">Todos os setores</option>
              {options &&
                companyOptions(options.areas).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            Unidade
            <select
              value={draft.unitId}
              onChange={(e) => setDraft({ ...draft, unitId: e.target.value })}
              className={input}
            >
              <option value="">Todas as unidades</option>
              {options &&
                companyOptions(options.units).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            Status
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className={input}
            >
              <option value="">Todos os status</option>
              {statuses.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            Data inicial
            <input
              type="date"
              max={draft.endDate || "9999-12-30"}
              value={draft.startDate}
              onChange={(e) =>
                setDraft({ ...draft, startDate: e.target.value })
              }
              className={input}
            />
          </label>
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            Data final
            <input
              type="date"
              min={draft.startDate}
              max="9999-12-30"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className={input}
            />
          </label>
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            Responsável
            <select
              value={draft.responsibleUserId}
              onChange={(e) =>
                setDraft({ ...draft, responsibleUserId: e.target.value })
              }
              className={input}
            >
              <option value="">Todos os responsáveis</option>
              <option value="unassigned">Sem responsável</option>
              {options &&
                companyOptions(options.responsibles).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button disabled={loading} className={primary}>
              <Search className="h-4 w-4" />
              Aplicar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setDraft(emptyFilters);
                prepareLoad();
                setApplied({ ...emptyFilters });
                setPage(1);
              }}
              className={secondary}
            >
              Limpar
            </button>
          </div>
        </div>
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <button
            onClick={() => {
              prepareLoad();
              setVersion((v) => v + 1);
            }}
            className="ml-3 underline"
          >
            Tentar novamente
          </button>
        </p>
      )}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Processos encontrados
            </h2>
            <p aria-live="polite" className="mt-1 text-sm text-slate-500">
              {loading
                ? "Consultando dados..."
                : `${result?.total ?? 0} processos · ${filteredBy ? filteredBy + " filtros aplicados" : "todo o período"}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              aria-expanded={showColumns}
              onClick={() => setShowColumns(!showColumns)}
              className={secondary}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Colunas
            </button>
            {["pdf", "xlsx", "csv"].map((format) => (
              <button
                key={format}
                disabled={loading || !!exporting || !result || !selected.length}
                onClick={() => void handleExport(format)}
                className={format === "xlsx" ? primary : secondary}
              >
                {exporting === format ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {showColumns && (
          <fieldset className="flex flex-wrap gap-x-5 gap-y-3 border-b border-slate-100 bg-slate-50/60 p-5">
            <legend className="sr-only">
              Colunas do relatório e da exportação
            </legend>
            {columns.map((column) => (
              <label
                key={column.key}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(column.key)}
                  disabled={
                    selected.length === 1 && selected.includes(column.key)
                  }
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(column.key)
                        ? prev.filter((key) => key !== column.key)
                        : [...prev, column.key],
                    )
                  }
                  className="h-4 w-4 accent-indigo-600"
                />
                {column.label}
              </label>
            ))}
          </fieldset>
        )}
        {loading ? (
          <div role="status" className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
            <span className="sr-only">Carregando relatório</span>
          </div>
        ) : !result?.items.length ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-700">
              {error
                ? "Relatório indisponível"
                : "Nenhum processo neste recorte"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {error
                ? "Confira a mensagem acima e tente novamente."
                : "Ajuste os filtros ou consulte outro período."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Relatório de processos com filtros aplicados
              </caption>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {displayed.map((c) => (
                    <th
                      scope="col"
                      key={c.key}
                      className="whitespace-nowrap px-5 py-4 font-semibold"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-4">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/70">
                    {displayed.map((c) => (
                      <td
                        key={c.key}
                        className="max-w-xs px-5 py-4 text-slate-600"
                      >
                        {c.key === "status" ? (
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${["Aprovado", "Concluído"].includes(row.status || "") ? "bg-emerald-50 text-emerald-700" : row.status === "Rejeitado" ? "bg-rose-50 text-rose-700" : "bg-indigo-50 text-indigo-700"}`}
                          >
                            {row.status}
                          </span>
                        ) : c.key === "number" ? (
                          <Link
                            className="font-semibold text-indigo-600 hover:underline"
                            to={`/app/workflows/processes/${row.id}/confection`}
                          >
                            {row.number}
                          </Link>
                        ) : c.key.endsWith("At") ? (
                          <span className="whitespace-nowrap">
                            {row[c.key] ? date(row[c.key]!) : "—"}
                          </span>
                        ) : (
                          <span className="break-words">
                            {row[c.key] || "—"}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-5 py-4">
                      {row.canAssign ? (
                        <button
                          onClick={() => {
                            setEditing(row);
                            setAssignmentOptions([]);
                            setLoadingAssignment(true);
                            setResponsible(row.responsibleUserId || "");
                            setAssignmentError("");
                          }}
                          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                        >
                          <Users className="h-4 w-4" />
                          Atribuir responsável
                        </button>
                      ) : (
                        <span className="text-slate-400">Consulta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <p className="text-xs text-slate-500">
            Exportação: até 1.000 processos em PDF ou 5.000 em XLSX/CSV.
          </p>
          <div className="flex items-center gap-3">
            <button
              aria-label="Página anterior"
              disabled={loading || page === 1}
              onClick={() => {
                prepareLoad();
                setPage((p) => p - 1);
              }}
              className={secondary}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-600">
              {page} / {Math.max(1, Math.ceil((result?.total || 0) / 25))}
            </span>
            <button
              aria-label="Próxima página"
              disabled={loading || !result || page * 25 >= result.total}
              onClick={() => {
                prepareLoad();
                setPage((p) => p + 1);
              }}
              className={secondary}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </div>
      <dialog
        ref={assignmentDialog}
        aria-label="Atribuir responsável"
        onCancel={(e) => {
          if (saving) e.preventDefault();
          else setEditing(null);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-indigo-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/40"
      >
        {editing && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                Responsável por {editing.number}
              </h2>
              <button
                aria-label="Fechar atribuição"
                disabled={saving}
                onClick={() => setEditing(null)}
                className={secondary}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              O usuário deve poder tratar processos deste setor. A alteração
              fica registrada no histórico.
            </p>
            {assignmentError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {assignmentError}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Responsável pelo processo</span>
                <select
                  disabled={loadingAssignment || saving}
                  className={input}
                  value={responsible}
                  onChange={(e) => {
                    setResponsible(e.target.value);
                    setAssignmentError("");
                  }}
                >
                  <option value="">Sem responsável</option>
                  {assignmentOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={saving || loadingAssignment || !!assignmentError}
                onClick={() => void saveAssignment()}
                className={primary}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar atribuição
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

function DocumentPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessedDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await processDocument(file));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          O conteúdo do documento, pronto para consulta
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Extraia texto e tabelas de DOCX, XLSX, CSV e PDF. O processamento é
          somente leitura: o arquivo não é armazenado e os dados não alteram os
          processos.
        </p>
        <div className="mt-6 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 p-6">
          <Upload className="mb-3 h-7 w-7 text-indigo-500" />
          <label className="block text-sm font-semibold text-slate-700">
            Escolha um documento
            <input
              disabled={busy}
              type="file"
              accept=".docx,.xlsx,.csv,.pdf"
              className="mt-3 block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-100 file:px-4 file:py-2 file:font-semibold file:text-indigo-700"
              onChange={(e) => {
                setResult(null);
                setError("");
                const chosen = e.target.files?.[0] ?? null;
                if (chosen && chosen.size > 10 * 1024 * 1024) {
                  setError("O arquivo deve ter até 10 MB.");
                  setFile(null);
                  e.target.value = "";
                } else setFile(chosen);
              }}
            />
          </label>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Até 10 MB. PDFs precisam conter texto; OCR não está incluído.
            Fórmulas e macros não são executadas.
          </p>
        </div>
        <button
          disabled={!file || busy}
          onClick={() => void submit()}
          className={`${primary} mt-5`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSearch className="h-4 w-4" />
          )}
          {busy ? "Processando documento..." : "Extrair conteúdo"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                {result.format}{" "}
                {result.pageCount ? `· ${result.pageCount} páginas` : ""}
              </p>
              <h2 className="mt-1 break-all text-lg font-bold text-slate-800">
                {result.fileName}
              </h2>
            </div>
            <button
              className={secondary}
              onClick={() =>
                download(
                  new Blob([JSON.stringify(result, null, 2)], {
                    type: "application/json",
                  }),
                  "documento-processado.json",
                )
              }
            >
              <Download className="h-4 w-4" />
              Baixar resultado JSON
            </button>
          </div>
          {result.warnings.length > 0 && (
            <ul className="space-y-2 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Texto extraído
            </h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-5 font-sans text-sm leading-7 text-slate-600">
              {result.text || "Nenhum texto encontrado."}
            </pre>
          </div>
          {result.tables.map((table, index) => (
            <div key={index}>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                {table.name}{" "}
                <span className="font-normal text-slate-400">
                  · {table.rows.length} linhas na extração
                </span>
              </h3>
              <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">{table.name}</caption>
                  <tbody className="divide-y divide-slate-100">
                    {table.rows.slice(0, 50).map((row, r) => (
                      <tr
                        key={r}
                        className={
                          r === 0
                            ? "bg-slate-50 font-semibold text-slate-700"
                            : "text-slate-600"
                        }
                      >
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            className="min-w-32 max-w-md break-words border-r border-slate-100 px-4 py-3"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {table.rows.length > 50 && (
                <p className="mt-2 text-xs text-slate-500">
                  Mostrando as primeiras 50 linhas. O JSON contém todas as
                  linhas extraídas.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
