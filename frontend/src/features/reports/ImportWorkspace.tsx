import { NativeSelectDropdown } from '../../shared/components/NativeSelectDropdown';
import { SystemNotice } from '../../shared/components';
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  Loader2,
  Upload,
} from "lucide-react";
import { apiFetch, apiFetchBlob } from "../../shared/api";
import { download } from "./api";
import type { Option } from "./api";

type Kind = "units" | "users" | "workflows" | "guides";
type Options = {
  kinds: Kind[];
  companies: Option[];
  workflowAreas: Option[];
  guideAreas: Option[];
};
type Preview = {
  token: string | null;
  expiresAt: string | null;
  total: number;
  valid: number;
  rows: {
    number: number;
    values: Record<string, string>;
    errors: string[];
    warnings: string[];
  }[];
};
type Result = {
  kind: Kind;
  created: number;
  credentials: {
    email: string;
    temporaryPassword: string;
    expiresAt: string;
  }[];
};
const labels: Record<Kind, string> = {
  units: "Unidades",
  users: "Usuários",
  workflows: "Workflows",
  guides: "Orientações",
};
const instructions: Record<Kind, string> = {
  units:
    "Cadastre unidades na empresa selecionada. Nome e código devem ser únicos; cidade e UF são opcionais.",
  users:
    "Cadastre contas com perfil e unidade. Cada usuário recebe uma senha temporária individual, entregue ao administrador ao concluir. O primeiro acesso exige troca de senha.",
  workflows:
    "Importe a estrutura completa: etapas, campos, opções e transições. Os workflows entram como rascunho para revisão e homologação no editor.",
  guides:
    "Cadastre orientações no setor selecionado. Categorias novas serão criadas; publicar=sim disponibiliza a orientação aos leitores.",
};
const schemas: Record<Kind, string[]> = {
  units: [
    "nome: obrigatório, até 200 caracteres",
    "codigo: obrigatório, até 50 caracteres",
    "cidade: opcional",
    "uf: opcional, duas letras (ex.: PR)",
  ],
  users: [
    "nome: obrigatório",
    "email: obrigatório e único",
    "perfil: AREA_ADMIN, HEADQUARTER_USER ou UNIT_USER; COMPANY_ADMIN apenas para Super Admin",
    "unidade_codigo: obrigatório para UNIT_USER; vazio para perfis da sede",
  ],
  workflows: [
    "codigo, nome, descricao, publico (Todos, Sede ou Unidades)",
    "etapas: codigo, nome e tipo (inicio, etapa, aprovacao ou fim)",
    "campos: codigo, nome, tipo, etapa, obrigatorio e opcoes",
    "transicoes: origem, destino e permiteRetorno",
  ],
  guides: [
    "titulo: obrigatório e único no setor",
    "categoria: obrigatória; será criada se não existir",
    "conteudo: texto de até 50.000 caracteres",
    "url: opcional, http ou https",
    "publicar: sim ou nao; vazio cria rascunho",
  ],
};
const input =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50";
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir a importação.";

export function ImportWorkspace({ extraction }: { extraction: ReactNode }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [version, setVersion] = useState(0);
  const [selectedKind, setKind] = useState<Kind | "">("");
  const [selectedCompany, setCompany] = useState("");
  const [area, setArea] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Options>("/api/imports/options", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setOptions(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [version]);
  const kind = selectedKind || options?.kinds[0] || "units";
  const company =
    selectedCompany ||
    (options?.companies.length === 1 ? options.companies[0].id : "");
  const needsArea = kind === "workflows" || kind === "guides";
  const areas =
    (kind === "workflows"
      ? options?.workflowAreas
      : options?.guideAreas
    )?.filter((a) => a.companyId === company) ?? [];
  function reset() {
    setPreview(null);
    setResult(null);
    setError("");
    setAcknowledged(false);
  }
  async function template(format: string) {
    setBusy("template");
    setError("");
    try {
      download(
        await apiFetchBlob(`/api/imports/${kind}/template/${format}`),
        `modelo-${kind}.${format}`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }
  async function validate() {
    if (!file || !company || (needsArea && !area)) return;
    reset();
    setBusy("preview");
    const data = new FormData();
    data.append("file", file);
    data.append("companyId", company);
    if (needsArea) data.append("areaId", area);
    try {
      setPreview(
        await apiFetch<Preview>(`/api/imports/${kind}/preview`, {
          method: "POST",
          body: data,
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }
  async function confirm() {
    if (!preview?.token) return;
    setBusy("confirm");
    setError("");
    try {
      setResult(
        await apiFetch<Result>("/api/imports/confirm", {
          method: "POST",
          body: JSON.stringify({ token: preview.token }),
        }),
      );
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(errorMessage(err));
      setPreview(null);
      setAcknowledged(false);
    } finally {
      setBusy("");
    }
  }
  function credentialCsv() {
    if (!result) return;
    const quote = (value: string) =>
      '"' +
      (/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""') +
      '"';
    const rows = result.credentials.map((c) =>
      [c.email, c.temporaryPassword, c.expiresAt].map(quote).join(";"),
    );
    download(
      new Blob(
        ["\uFEFFemail;senha_temporaria;validade_utc\r\n" + rows.join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      "acessos-importados.csv",
    );
  }
  const destination =
    kind === "users"
      ? "/app/users"
      : kind === "units"
        ? `/app/companies/${company}`
        : kind === "workflows"
          ? `/app/workflows?areaId=${area}`
          : `/app/guide?areaId=${area}`;
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
            <Upload className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Importar cadastros no Sicou
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Preencha o modelo, confira os dados e confirme o cadastro em lote.
              A prévia aponta erros e duplicidades antes de salvar.
            </p>
          </div>
        </div>
        <ol className="my-6 grid gap-3 text-sm sm:grid-cols-3">
          {[
            "Baixar e preencher o modelo",
            "Validar os registros",
            "Confirmar o cadastro",
          ].map((step, i) => (
            <li
              key={step}
              className={`flex items-center gap-3 rounded-xl p-3 ${result || (preview && i < 2) ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        {options && options.kinds.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Seu perfil tem acesso de consulta. Solicite a importação a um
            administrador ou gestor do setor.
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600">
                O que deseja importar?
                <NativeSelectDropdown
                  disabled={!!busy || !options}
                  value={kind}
                  className={input}
                  onChange={(e) => {
                    reset();
                    setKind(e.target.value as Kind);
                    setArea("");
                    setFile(null);
                  }}
                >
                  {options?.kinds.map((k) => (
                    <option key={k} value={k}>
                      {labels[k]}
                    </option>
                  ))}
                </NativeSelectDropdown>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Empresa de destino
                <NativeSelectDropdown
                  disabled={!!busy || !options}
                  value={company}
                  className={input}
                  onChange={(e) => {
                    reset();
                    setCompany(e.target.value);
                    setArea("");
                  }}
                >
                  <option value="">Selecione a empresa</option>
                  {options?.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelectDropdown>
              </label>
              {needsArea && (
                <label className="text-xs font-semibold text-slate-600">
                  Setor de destino
                  <NativeSelectDropdown
                    disabled={!!busy || !company}
                    value={area}
                    className={input}
                    onChange={(e) => {
                      reset();
                      setArea(e.target.value);
                    }}
                  >
                    <option value="">Selecione o setor</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelectDropdown>
                </label>
              )}
            </div>
            <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
              <p className="text-sm leading-6 text-slate-700">
                {instructions[kind]}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(kind === "workflows" ? ["json"] : ["xlsx", "csv"]).map(
                  (format) => (
                    <button
                      key={format}
                      disabled={!!busy || !options}
                      className={button}
                      onClick={() => void template(format)}
                    >
                      <Download className="h-4 w-4" />
                      Baixar modelo {format.toUpperCase()}
                    </button>
                  ),
                )}
              </div>
              <details className="mt-4 text-sm text-slate-600">
                <summary className="cursor-pointer font-semibold">
                  Como preencher o modelo
                </summary>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {schemas[kind].map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </details>
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5">
              <label className="text-sm font-semibold text-slate-700">
                Arquivo preenchido
                <input
                  key={kind + (result ? "-done" : "")}
                  type="file"
                  accept={kind === "workflows" ? ".json" : ".csv,.xlsx"}
                  disabled={!!busy}
                  className="mt-3 block w-full text-sm font-normal text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-100 file:px-4 file:py-2 file:font-semibold file:text-indigo-700"
                  onChange={(e) => {
                    reset();
                    const next = e.target.files?.[0] ?? null;
                    const extension = next?.name
                      .split(".")
                      .pop()
                      ?.toLowerCase();
                    if (
                      next &&
                      (next.size > 2 * 1024 * 1024 ||
                        !(
                          kind === "workflows" ? ["json"] : ["csv", "xlsx"]
                        ).includes(extension || ""))
                    ) {
                      setFile(null);
                      setError("Use o modelo indicado, com até 2 MB.");
                      e.target.value = "";
                    } else setFile(next);
                  }}
                />
              </label>
              <p className="mt-3 text-xs text-slate-500">
                {kind === "workflows"
                  ? "JSON com até 10 workflows completos."
                  : "CSV UTF-8 ou XLSX com uma planilha e até 200 registros, sem fórmulas."}{" "}
                Máximo de 2 MB.
              </p>
            </div>
            <button
              className={`${primary} mt-5`}
              disabled={!!busy || !file || !company || (needsArea && !area)}
              onClick={() => void validate()}
            >
              {busy === "preview" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" />
              )}
              {busy === "preview" ? "Validando..." : "Validar e mostrar prévia"}
            </button>
          </>
        )}
      </div>
      {error && (
        <SystemNotice>
          <>
            {error}
            {!options && (
              <button
                className="ml-3 underline"
                onClick={() => {
                  setError("");
                  setVersion((v) => v + 1);
                }}
              >
                Tentar novamente
              </button>
            )}
          </>
        </SystemNotice>
      )}
      {preview && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900">
              Confira antes de importar
            </h3>
            <p role="status" className="mt-2 text-sm text-slate-500">
              {preview.valid} de {preview.total} registros válidos ·{" "}
              {labels[kind]} ·{" "}
              {options?.companies.find((c) => c.id === company)?.name}
            </p>
            {!preview.token && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Corrija todas as linhas indicadas e envie o arquivo novamente. A
                confirmação só fica disponível com o lote inteiro válido.
              </p>
            )}
          </div>
          <div className="max-h-[32rem] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Prévia da importação</caption>
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Registro</th>
                  {Object.keys(preview.rows[0]?.values ?? {}).map((key) => (
                    <th key={key} className="px-4 py-3">
                      {key}
                    </th>
                  ))}
                  <th className="px-4 py-3">Validação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row) => (
                  <tr
                    key={row.number}
                    className={row.errors.length ? "bg-rose-50/50" : ""}
                  >
                    <td className="px-4 py-3 text-slate-500">{row.number}</td>
                    {Object.entries(row.values).map(([key, value]) => (
                      <td
                        key={key}
                        className="min-w-32 max-w-sm px-4 py-3 text-slate-600"
                      >
                        <div className="max-h-36 overflow-auto whitespace-pre-wrap break-words">
                          {value || "—"}
                        </div>
                      </td>
                    ))}
                    <td className="min-w-72 px-4 py-3">
                      {row.errors.length ? (
                        row.errors.map((text) => (
                          <p key={text} className="mb-1 text-xs text-rose-700">
                            {text}
                          </p>
                        ))
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <Check className="h-4 w-4" />
                          Pronto para importar
                        </span>
                      )}
                      {row.warnings.map((text) => (
                        <p
                          key={text}
                          className="mt-2 text-xs leading-5 text-amber-700"
                        >
                          {text}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.token && (
            <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-6">
              <p className="text-sm text-slate-600">
                Serão criados {preview.total} registros. Os cadastros existentes
                serão preservados. Esta prévia vale até{" "}
                {new Date(preview.expiresAt!).toLocaleTimeString("pt-BR")}.
              </p>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={!!busy}
                  className="mt-1 accent-indigo-600"
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                Conferi o destino e os dados e confirmo a criação deste lote.
              </label>
              <button
                disabled={!acknowledged || !!busy}
                onClick={() => void confirm()}
                className={primary}
              >
                {busy === "confirm" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {busy === "confirm"
                  ? "Importando..."
                  : `Confirmar importação de ${preview.total} registros`}
              </button>
            </div>
          )}
        </section>
      )}
      {result && (
        <section className="space-y-4 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h3
            role="status"
            className="flex items-center gap-2 text-lg font-bold text-emerald-800"
          >
            <CheckCircle2 className="h-5 w-5" />
            {result.created} registros cadastrados
          </h3>
          {result.credentials.length > 0 && (
            <>
              <p className="text-sm leading-6 text-slate-600">
                Baixe e entregue as senhas temporárias por um canal privado.
                Elas ficam disponíveis nesta tela somente agora e expiram em 24
                horas. Configure as permissões de área no perfil de cada
                usuário.
              </p>
              <button className={primary} onClick={credentialCsv}>
                <Download className="h-4 w-4" />
                Baixar acessos temporários
              </button>
              <p className="text-xs text-slate-500">
                Guarde o arquivo antes de sair desta aba. Nenhum e-mail é
                enviado por esta importação.
              </p>
            </>
          )}
          <Link className={button} to={destination}>
            Ver cadastros
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}
      <details className="rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">
          Consultar texto de um DOCX ou PDF
        </summary>
        <p className="my-4 text-sm leading-6 text-slate-500">
          Esta consulta apenas mostra texto e tabelas. Para criar cadastros, use
          os modelos da importação acima.
        </p>
        {extraction}
      </details>
    </div>
  );
}
