import { apiFetch, apiFetchBlob } from "../../shared/api/apiFetch";

export type Option = {
  id: string;
  name: string;
  companyId: string | null;
  areaId: string | null;
};
export type ReportOptions = {
  companies: Option[];
  areas: Option[];
  units: Option[];
  responsibles: Option[];
};
export type Filters = {
  companyId: string;
  areaId: string;
  unitId: string;
  status: string;
  responsibleUserId: string;
  startDate: string;
  endDate: string;
  movement: string;
};
export const emptyFilters: Filters = {
  companyId: "",
  areaId: "",
  unitId: "",
  status: "",
  responsibleUserId: "",
  startDate: "",
  endDate: "",
  movement: "",
};
export const columns = [
  { key: "number", label: "Número" },
  { key: "title", label: "Título" },
  { key: "company", label: "Empresa" },
  { key: "area", label: "Setor" },
  { key: "unit", label: "Unidade" },
  { key: "processType", label: "Tipo de processo" },
  { key: "status", label: "Status" },
  { key: "responsible", label: "Responsável" },
  { key: "createdBy", label: "Solicitante" },
  { key: "createdAt", label: "Criado em (UTC)" },
  { key: "updatedAt", label: "Atualizado em (UTC)" },
  { key: "currentStage", label: "Etapa atual", group: "tracking" },
  { key: "currentUnit", label: "Unidade atual", group: "tracking" },
  { key: "openedBy", label: "Protocolado por", group: "tracking" },
  { key: "openedAt", label: "Protocolado em (UTC)", group: "tracking" },
  { key: "closedAt", label: "Encerrado em (UTC)", group: "tracking" },
  { key: "daysOpen", label: "Dias em tramitação", group: "tracking" },
  { key: "daysInStage", label: "Dias na etapa atual", group: "tracking" },
  { key: "movements", label: "Movimentações", group: "tracking" },
  { key: "advances", label: "Avanços", group: "tracking" },
  { key: "returns", label: "Devoluções/reinícios", group: "tracking" },
  { key: "transfers", label: "Transferências", group: "tracking" },
  { key: "comments", label: "Comentários", group: "tracking" },
  { key: "lastMovementAt", label: "Última movimentação (UTC)", group: "tracking" },
  { key: "lastMovementAction", label: "Última ação", group: "tracking" },
  { key: "lastMovementBy", label: "Última ação por", group: "tracking" },
  { key: "lastObservation", label: "Última observação", group: "tracking" },
  { key: "stagePath", label: "Caminho das etapas", group: "tracking" },
  { key: "unitPath", label: "Caminho das unidades", group: "tracking" },
  { key: "participants", label: "Participantes", group: "tracking" },
  { key: "formData", label: "Dados do formulário", group: "tracking" },
] as const satisfies readonly { key: string; label: string; group?: "tracking" }[];
export type ColumnKey = (typeof columns)[number]["key"];
export const trackingKeys = columns
  .filter((c) => "group" in c && c.group === "tracking")
  .map((c) => c.key);
export type ReportRow = Record<ColumnKey, string | number | null> & {
  id: string;
  companyId: string;
  areaId: string;
  originUnitId: string | null;
  responsibleUserId: string | null;
  canAssign: boolean;
};
export type ReportResult = {
  items: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
};
export type ProcessedDocument = {
  fileName: string;
  format: string;
  text: string;
  pageCount: number | null;
  warnings: string[];
  tables: { name: string; rows: string[][] }[];
};

function parameters(filters: Filters, selected: string[], page = 1) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "25",
    columns: selected.join(","),
  });
  Object.entries(filters).forEach(([key, value]) => {
    if (key === "responsibleUserId" && value === "unassigned")
      params.set("unassignedOnly", "true");
    else if (value) params.set(key, value);
  });
  return params;
}
export const getOptions = (signal?: AbortSignal) =>
  apiFetch<ReportOptions>("/api/reports/options", { signal });
export const getReport = (
  filters: Filters,
  selected: string[],
  page: number,
  signal?: AbortSignal,
) =>
  apiFetch<ReportResult>(
    `/api/reports/processes?${parameters(filters, selected, page)}`,
    { signal },
  );
export const exportReport = (
  filters: Filters,
  selected: string[],
  format: string,
) =>
  apiFetchBlob(
    `/api/reports/processes/export/${format}?${parameters(filters, selected)}`,
  );
export const assignResponsible = (id: string, userId: string | null) =>
  apiFetch<void>(`/api/reports/processes/${id}/responsible`, {
    method: "PUT",
    body: JSON.stringify({ userId }),
  });
export const getAssignmentOptions = (id: string, signal?: AbortSignal) =>
  apiFetch<Option[]>(`/api/reports/processes/${id}/responsible-options`, {
    signal,
  });
export async function processDocument(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<ProcessedDocument>("/api/documents/process", {
    method: "POST",
    body,
  });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type CatalogKind = "units" | "users" | "guides" | "movements";
export type CatalogFilters = {
  companyId: string;
  unitId: string;
  areaId: string;
  categoryId: string;
  search: string;
  city: string;
  state: string;
  role: string;
  status: string;
  startDate: string;
  endDate: string;
};
export const emptyCatalogFilters: CatalogFilters = {
  companyId: "",
  unitId: "",
  areaId: "",
  categoryId: "",
  search: "",
  city: "",
  state: "",
  role: "",
  status: "",
  startDate: "",
  endDate: "",
};
export type CatalogColumn = {
  key: string;
  label: string;
  type: "text" | "date" | "number";
};
export type CatalogResult = {
  columns: CatalogColumn[];
  items: { id: string; values: Record<string, string | number | null> }[];
  total: number;
  page: number;
  pageSize: number;
};
export type CatalogOptions = {
  kinds: CatalogKind[];
  companies: Option[];
  areas: Option[];
  units: Option[];
  categories: Option[];
};
function catalogParameters(
  filters: CatalogFilters,
  page: number,
  selected?: string[],
) {
  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });
  if (selected) params.set("columns", selected.join(","));
  return params;
}
export const getCatalogOptions = (signal?: AbortSignal) =>
  apiFetch<CatalogOptions>("/api/reports/catalog/options", { signal });
export const getCatalog = (
  kind: CatalogKind,
  filters: CatalogFilters,
  page: number,
  signal?: AbortSignal,
) =>
  apiFetch<CatalogResult>(
    `/api/reports/catalog/${kind}?${catalogParameters(filters, page)}`,
    { signal },
  );
export const exportCatalog = (
  kind: CatalogKind,
  filters: CatalogFilters,
  selected: string[],
  format: string,
) =>
  apiFetchBlob(
    `/api/reports/catalog/${kind}/export/${format}?${catalogParameters(filters, 1, selected)}`,
  );
